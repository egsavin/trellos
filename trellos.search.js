'use strict'
// Trellos.Search plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;


Trellos.Search = (props) => {
    const [searchProgress, setSearchProgress] = React.useState(false);
    const [searchResult, setSearchResult] = React.useState(null);

    const onSearch = (filter) => {
        if (searchProgress) return false;
        setSearchProgress(true);
        setSearchResult(null);
        Trellos.Search.doSearch(props.me, filter).then(onSearchFinished);
    }

    const onSearchFinished = (result) => {
        console.log('finished', result.length);
        setSearchProgress(false);
        setSearchResult(result);
    }

    return e(React.Fragment, { key: 'trellos-search' },
        e(Trellos.Search.Form, {
            onSubmit: onSearch,
            inProgress: searchProgress,
            ...props
        }),
        // !searchProgress && searchResult ? e(Trellos.Search.Result, { data: searchResult }) : null
    );
}


Trellos.Search.PluginTab = (props) => {
    return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'search' },
        e('i', { className: 'fas fa-search d-inline-block d-sm-none mx-2' }),
        e('span', { className: 'd-none d-sm-inline-block' }, 'Поиск')
    ))
}


// register plugin
trellos.plugins.push({
    name: 'search',
    tab: Trellos.Search.PluginTab,
    body: Trellos.Search
});

Trellos.Search.config = {
    minWordLengthToStem: 4,
    minQueryLength: 2,
    searchCacheTtl: 1000 * 60 * 5,
    searchPageSize: 30,
}


Trellos.Search.validateQuery = (text) => {
    if (text == null || text == undefined) return false;
    text = text.trim();
    let valid = text.length >= Trellos.Search.config.minQueryLength;
    valid = valid && Porter.stemText(text, Trellos.Search.config.minWordLengthToStem).length > 0;
    return valid;
}


Trellos.Search.doSearch = async (me, filter) => {
    const findText = (stemQuery, stemText) => {
        let result = [];
        if (!stemQuery || !stemText) return null; // error parameters
        stemQuery.forEach((wordQuery) => {
            let ok = stemText.find(wordText => wordText == wordQuery);
            if (ok) result.push(wordQuery);
        });
        return result;
    }

    const cardCreatedComparer = (a, b) => {
        if (!a || !b) return 0;
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
    }

    const cardLastActivityComparer = (a, b) => {
        if (!a || !b) return 0;
        let da = new Date(a.dateLastActivity);
        let db = new Date(b.dateLastActivity);
        if (da > db) return -1;
        if (da < db) return 1;
        return 0;
    }


    let ctx = { ...filter };
    if (ctx.allBoards) ctx.boards = me.boards.map(board => board.id);

    let allCards = [];
    for (let i = 0; i < ctx.boards.length; i++) {
        const idBoard = ctx.boards[i];
        const cacheKey = `search-${idBoard}`;
        let boardCards = trellos.cache.getItem(cacheKey);
        if (boardCards == null) {
            boardCards = await trellos.getRecursive(`boards/${idBoard}/cards`, {
                // загружаю все карточки из доски и кеширую. фильтрация по условиям — потом
                filter: "all",
                fields: "id,name,desc,idBoard,idList,labels,closed,shortLink,shortUrl,dateLastActivity",
                members: "true",
                members_fields: "id,fullName,username,initials"
            })
            trellos.cache.setItem(cacheKey, boardCards, Trellos.Search.config.searchCacheTtl)
        }
        allCards.push(...boardCards);
    };

    console.log('allcards', allCards.length);

    let searchResult = [];
    ctx.stemQuery = Porter.stemText(ctx.query, Trellos.Search.config.minWordLengthToStem);
    ctx.momentSince = ctx.since ? moment(ctx.since) : null;
    ctx.momentBefore = ctx.before ? moment(ctx.before) : null;

    allCards.forEach(card => {
        if (!ctx.allowArchive && card.closed) return;
        let isOk = true;
        card.momentCreated = trellos.convertTrelloIdToMoment(card.id);

        // фильтрация по периоду
        if (ctx.momentSince && ctx.momentSince.isValid()) {
            isOk = card.momentCreated.isSameOrAfter(ctx.momentSince, 'day');
        }
        if (isOk && ctx.momentBefore && ctx.momentBefore.isValid()) {
            isOk = card.momentCreated.isSameOrBefore(ctx.momentBefore, 'day');
        }
        if (!isOk) return;

        card.stemName = Porter.stemText(card.name, Trellos.Search.config.minWordLengthToStem);
        card.stemDesc = Porter.stemText(card.desc, Trellos.Search.config.minWordLengthToStem);
        // фильтрация по словам в имени карточки
        let findedWords = findText(ctx.stemQuery, card.stemName) || [];
        isOk = ctx.allWords ? findedWords.length == ctx.stemQuery.length : findedWords.length > 0;
        // фильтрация по словам в описании (если по имени не подошло)
        if (!isOk) {
            findedWords = trellos.unionArrays(findedWords, findText(ctx.stemQuery, card.stemDesc) || []);
            isOk = ctx.allWords ? findedWords.length == ctx.stemQuery.length : findedWords.length > 0;
        }
        if (!isOk) return;
        card.board = me.boards.find(b => b.id == card.idBoard); // аттач board 
        card.list = card.board.lists.find(l => l.id == card.idList); // аттач list
        card.finded = findedWords;
        searchResult.push(card);
    })

    searchResult.sort(ctx.sortMode == 'created' ? cardCreatedComparer : cardLastActivityComparer);
    searchResult.hash = trellos.rndstr();

    const filterData = JSON.stringify(filter);
    searchResult.url = document.location.origin + document.location.pathname +
        "?search=" + btoa(encodeURIComponent(filterData)) +
        "&tab=search";

    return searchResult;
}




Trellos.Search.Form = function (props) {
    const initial = trellos.g(trellos.initialState(), 'search', null);
    const [state, setState] = React.useState(initial);
    const [allBoards, setAllBoards] = React.useState(trellos.g(initial, 'allBoards', false));
    const [boards, setBoards] = React.useState(trellos.g(initial, 'boards', []));
    const [query, setQuery] = React.useState(trellos.g(initial, 'query', ''));
    const [period, setPeriod] = React.useState({
        since: trellos.g(initial, 'since', null),
        before: trellos.g(initial, 'before', null)
    });
    const [flags, setFlags] = React.useState({
        allWords: trellos.g(initial, 'allWords', true),
        allowArchive: trellos.g(initial, 'allowArchive', false),
        sortMode: trellos.g(initial, 'sortMode', "modified"),
    });

    const onSubmit = (event) => {
        if (event) event.preventDefault();
        props.onSubmit({ ...state });
    }

    const onChangeQuery = (event) => {
        const newQuery = event.target.value.trim();
        setQuery(newQuery);
        upState('query', newQuery);
    }

    const onChangeFlag = (event) => {
        const cb = event.target.closest('input[type="checkbox"]');
        if (!cb) return;
        let newFlags = { ...flags };
        switch (cb.name) {
            case 'sortMode':
                newFlags[cb.name] = cb.checked ? "created" : "modified";
                break;
            default:
                newFlags[cb.name] = cb.checked;
        }
        setFlags(newFlags);
        upState(cb.name, newFlags[cb.name]);
    }

    const onSelectBoard = (event) => {
        const cb = event.target.closest('input[type="checkbox"]');
        if (!cb) return;
        if (cb.value == 'all') {
            setAllBoards(cb.checked);
            upState('allBoards', cb.checked);
        } else {
            let newBoards = boards.filter(idBoard => idBoard != cb.value);
            if (cb.checked) newBoards.push(cb.value);
            setBoards(newBoards);
            upState('boards', newBoards);
        }
    }

    const onChangePeriod = (name, text, mdate) => {
        if (name != 'since' && name != 'before') return;
        text = text.trim();
        let newPeriod = { ...period };
        newPeriod[name] = text.length ? mdate : null;
        setPeriod(newPeriod);
        const upValue = text.length && mdate.isValid() ? mdate.format("DD.MM.YYYY") : null;
        upState(name, upValue);
    }

    const isInvalidPeriod = (name) => {
        if (name != 'since' && name != 'before') return null;
        if (period[name] === null) return null;
        const [validSince, validBefore] = trellos.validatePeriod(period.since, period.before);
        return !(name == 'since' ? validSince : validBefore);
    }

    const isValidForm = () => {
        const [validSince, validBefore] = trellos.validatePeriod(period.since, period.before);
        return Trellos.Search.validateQuery(query) &&
            validSince &&
            validBefore &&
            (
                allBoards || Object.keys(boards).length
            )
    }

    const isInvalidQuery = () => {
        if (!query.trim()) return null;
        return !Trellos.Search.validateQuery(query);
    }

    const upState = (name, value) => {
        let newState = { ...state }
        newState[name] = value;
        setState(newState);
        let newUpState = { ...newState }
        // не сохраняем в глобальном состоянии текст запроса и период
        delete newUpState.query;
        delete newUpState.since;
        delete newUpState.before;
        props.onUpState('search', newUpState);
    }

    return e(BS.Form, { onSubmit: onSubmit, id: 'trellos-search-form' },
        e(BS.Form.Group, null,
            e(BS.Form.Control, {
                type: 'text',
                placeholder: 'Поиск в Trello',
                size: 'lg', id: 'trellos-search-query',
                onChange: onChangeQuery,
                isInvalid: isInvalidQuery(),
                defaultValue: query
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true,
                type: 'checkbox',
                label: 'Все слова',
                defaultChecked: flags.allWords,
                id: 'trellos-search-all-words',
                name: 'allWords',
                onChange: onChangeFlag,
            }),
            e(BS.Form.Check, {
                inline: true,
                type: 'checkbox',
                label: 'Искать в архиве',
                id: 'trellos-search-archive',
                defaultChecked: flags.allowArchive,
                name: 'allowArchive',
                onChange: onChangeFlag,
            }),
            e(BS.Form.Check, {
                inline: true,
                type: 'checkbox',
                label: 'Сортировка по созданию',
                id: 'trellos-search-sort-alt',
                defaultChecked: flags.sortMode == 'created',
                name: 'sortMode',
                onChange: onChangeFlag,
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true,
                className: 'font-weight-bold mb-1',
                id: 'trellos-search-all-boards',
                value: 'all',
                label: 'Все доски',
                onChange: onSelectBoard,
                defaultChecked: allBoards
            }),
            allBoards ? null : props.me.boards
                .sort((a, b) => {
                    let sortStar = a.starred === b.starred ? 0 : (
                        a.starred && !b.starred ? -1 : 1
                    )
                    let sortAlpha = a.name == b.name ? 0 : (
                        a.name > b.name ? 1 : -1
                    )
                    return sortStar === 0 ? sortAlpha : sortStar;
                })
                .map(board => {
                    return e(BS.Form.Check, {
                        inline: true,
                        type: 'checkbox',
                        label: board.name,
                        name: 'trellos-search-board',
                        id: `trellos-search-board-${board.id}`,
                        value: board.id, key: board.id,
                        onChange: onSelectBoard, className: 'mb-1',
                        defaultChecked: boards.includes(board.id)
                    })
                })
        ),
        e(BS.Form.Group, { className: 'mb-0' }, 'Дата создания'),
        e(BS.Form.Group, null,
            e(BS.Row, null,
                e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
                    e(Trellos.Form.DateControl, {
                        placeholder: 'от (дд.мм.гггг)',
                        name: 'since',
                        onChange: (text, mdate) => onChangePeriod('since', text, mdate),
                        isInvalid: isInvalidPeriod('since'),
                        defaultValue: trellos.g(state, 'since', ''),
                        id: 'trellos-search-since'
                    })
                ),
                e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
                    e(Trellos.Form.DateControl, {
                        placeholder: 'по (дд.мм.гггг)',
                        name: 'before',
                        onChange: (text, mdate) => onChangePeriod('before', text, mdate),
                        isInvalid: isInvalidPeriod('before'),
                        defaultValue: trellos.g(state, 'before', ''),
                        id: 'trellos-search-before'
                    })
                ),
            )
        ),
        e(BS.Form.Group, { className: 'my-4' },
            e(BS.Button, {
                disabled: !isValidForm() || props.inProgress,
                type: 'submit', size: 'lg', className: 'px-4 mr-3',
                id: 'trellos-search-submit-button'
            },
                props.inProgress ? e(Trellos.Spinner, { className: 'mr-2' }) : null,
                props.inProgress ? 'Поиск…' : 'Найти'
            )
        )
    );
}
