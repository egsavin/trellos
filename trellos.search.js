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
        setSearchProgress(false);
        setSearchResult(result);
    }

    return e(React.Fragment, { key: 'trellos-search' },
        e(Trellos.Search.Form, {
            ...props,
            onSubmit: onSearch,
            inProgress: searchProgress,
        }),
        searchProgress || !searchResult ? null : e(Trellos.Search.Result, { data: searchResult, ...props })
    );
}


Trellos.Search.PluginTab = (props) => {
    return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'search' },
        e('i', { className: 'fas fa-search d-inline-block d-sm-none mx-2' }),
        e('span', { className: 'd-none d-sm-inline-block' }, 'Поиск')
    ))
}


Trellos.Search.plugin = {
    name: 'search',
    tab: Trellos.Search.PluginTab,
    body: Trellos.Search
}


Trellos.Search.config = {
    minWordLengthToStem: 4,
    minQueryLength: 2,
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
        // загружаю все карточки из доски и кеширую. фильтрация по условиям — потом
        let boardCards = await trellos.boardCards(idBoard);
        if (boardCards && boardCards.length) allCards.push(...boardCards);
    };

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
    const firstTime = (newValue = undefined) => {
        if (newValue !== undefined) Trellos.Search.firstTime = newValue;
        return trellos.g(Trellos.Search, 'firstTime', true);
    }

    const initial = trellos.g(trellos.initialState(), 'search', null);
    const [state, setState] = React.useState(initial);
    const [allBoards, setAllBoards] = React.useState(trellos.g(initial, 'allBoards', false));
    const [boards, setBoards] = React.useState(trellos.g(initial, 'boards', []));
    // query инициализируется только при первом рендере
    const [query, setQuery] = React.useState(firstTime() ? trellos.g(initial, 'query', '') : '');
    const [period, setPeriod] = React.useState({
        // период инициализируется только при первом рендере
        since: firstTime() ? trellos.g(initial, 'since', null) : null,
        before: firstTime() ? trellos.g(initial, 'before', null) : null
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
        delete newUpState['query'];
        delete newUpState['since'];
        delete newUpState['before'];
        props.onUpState('search', newUpState);
    }

    React.useEffect(() => { // init effect
        // если при первом рендере не пустой текст запроса, 
        // значит он был получен из инициирующего состояния (из прямой ссылки)
        // и нужно автоматически выполнить поиск
        // срабатывает один раз, признак сохраняется в статическом флаге
        if (query && firstTime()) {
            onSubmit(null);
            firstTime(false);
        }
    }, [])

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
                .sort(trellos.boardStarredAlphaComparer)
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


Trellos.Search.Result = function (props) {
    const [page, setPage] = React.useState(0);
    const [hash, setHash] = React.useState(null);

    const onChangePage = (pageIndex) => {
        if (pageIndex == page) return;
        setPage(pageIndex);
        document.getElementById('trellos-search-result')
            .scrollIntoView({ block: "start", behavior: "auto", inline: "nearest" });
    }

    React.useEffect(() => {
        if (hash != props.data.hash) {
            setPage(0)
            setHash(props.data.hash)
        }
    });

    const pagesCount = () => {
        return Math.ceil(props.data.length / pageSize());
    }

    const pageSize = () => {
        const maxPagesCount = 10;
        let pageCount = Math.ceil(props.data.length / Trellos.Search.config.searchPageSize);
        if (pageCount > maxPagesCount) return Math.ceil(props.data.length / maxPagesCount);
        return Trellos.Search.config.searchPageSize;
    }

    const pagination = () => {
        let pages = [];
        for (let i = 0; i < pagesCount(); i++) {
            pages.push(e(BS.Pagination.Item, { key: i, active: i == page, onClick: () => { onChangePage(i) } }, `${i + 1}`));
        }
        return pages;
    }

    const dataPage = () => props.data.slice(page * pageSize(), (page + 1) * pageSize());

    return e('div', { className: 'mt-4', id: 'trellos-search-result' },
        e(Trellos.Search.Result.Head, { data: props.data }),
        dataPage().map((card, i) => e(Trellos.Search.Result.Card, {
            key: card.id,
            card: card,
            index: page * pageSize() + i
        })),
        pagesCount() > 1 ? e(BS.Pagination, null, pagination()) : null
    );
}


Trellos.Search.Result.Card = function (props) {
    const toggleDescr = (event) => {
        const link = event.target.closest('a');
        if (!link) return;
        const idCard = link.getAttribute('card');
        if (!idCard) return;
        event.preventDefault();
        const cardDesc = document.querySelector(`.trellos-card-desc[card="${idCard}"]`);
        if (!cardDesc) return;
        if (cardDesc.getAttribute('opened')) {
            cardDesc.removeAttribute('opened');
            cardDesc.style.maxHeight = "10rem";
            link.innerHTML = "Развернуть";
        } else {
            cardDesc.setAttribute('opened', "true");
            cardDesc.style.maxHeight = null;
            link.innerHTML = "Свернуть"
        }
        document.querySelector(`.trellos-card[card="${idCard}"]`)
            .scrollIntoView({ block: "start", behavior: "smooth", inline: "nearest" });
    }

    const onCopyUrl = (event) => {
        trellos.blinkClass(event.target.closest('a'), '', 'text-success');
    }

    const styles = {
        cardCreatedAt: {
            fontSize: '60%'
        },
        cardLinkInput: {
            padding: 0,
            width: '1px',
            fontSize: '1px',
            display: 'inline',
            border: 'none',
            color: 'transparent',
            backgroundColor: 'transparent'
        }
    }

    return e(BS.Card, { className: 'mb-5 trellos-card', card: props.card.id }, e(BS.Card.Body, null,
        e(BS.Card.Text, { className: 'text-secondary' },
            e('small', { className: 'mr-3' },
                e('b', { className: 'mr-3' }, props.index + 1),
                e('span', { className: 'mr-3' },
                    e('span', { title: 'Доска' }, props.card.board.name), ' / ',
                    e('span', { title: 'Список' }, props.card.list.name)
                ),
                props.card.labels.map(label => {
                    return e(Trellos.TrelloLabel, {
                        key: label.id + trellos.rndstr(),
                        variant: label.color,
                        className: 'mr-1'
                    }, label.name)
                })
            ),
            e('span', { className: "text-muted d-inline-block", title: "Время создания/посл. активности", style: styles.cardCreatedAt },
                e(Trellos.FA, { type: 'far', var: 'calendar-alt', className: 'mr-1' }),
                trellos.convertTrelloIdToMoment(props.card.id).format('DD.MM.YYYY hh:mm'),
                e(Trellos.FA, { var: 'calendar-alt', className: 'ml-2 mr-1' }),
                moment(props.card.dateLastActivity).format('DD.MM.YYYY hh:mm')
            )
        ),
        e(BS.Card.Subtitle, null,
            e(Trellos.Search.MarkedText, { className: 'mr-3', words: props.card.finded }, props.card.name),
            e('a', { className: 'text-primary fab fa-trello mr-2', target: '_blank', href: props.card.shortUrl }),
            e(Trellos.CopyToClipboard, {
                href: props.card.shortUrl,
                className: 'small text-secondary align-middle',
                onClick: onCopyUrl
            },
                e(Trellos.FA, { var: 'link' }),
                e(Trellos.FA, { type: 'far', var: 'copy' }),
            )
        ),
        e(BS.Card.Text, { className: 'text-secondary mt-2', style: { fontSize: "0.8rem" } },
            e('span', { className: 'mb-1 trellos-card-desc d-block', card: props.card.id, style: { overflow: 'hidden', maxHeight: "10rem" } },
                e(Trellos.Search.MarkedText, { words: props.card.finded, replaceNewline: true }, props.card.desc)
            ),
            e(Trellos.Muted, { className: 'mr-2' }, props.index + 1),
            e('a', { href: "#", card: props.card.id, onClick: toggleDescr }, 'Развернуть'),
        )
    ))
}


Trellos.Search.Result.Head = function (props) {
    const styles = {
        searchLinkInput: {
            padding: 0,
            width: '1px',
            fontSize: '1px',
            display: 'inline',
            border: 'none',
            color: 'transparent',
            backgroundColor: 'transparent'
        }
    }

    const onCopyUrl = (event) => {
        trellos.blinkClass(event.target.closest('a'), '', 'text-success');
    }

    if (!props.data.length) return e(BS.Alert, { variant: 'secondary' }, 'Ничего не найдено')
    return e('div', { className: 'mb-4' },
        e(Trellos.Muted, { className: 'mr-5' },
            trellos.declOfNum(props.data.length, "Найдена", "Найдено", "Найдено"),
            ` ${props.data.length} `,
            trellos.declOfNum(props.data.length, "карточка", "карточки", "карточек")
        ),
        e(Trellos.CopyToClipboard, {
            className: 'd-inline-block mr-5 small',
            href: props.data.url,
            onClick: onCopyUrl,
            text: 'Копировать ссылку на этот поиск'
        }),
        e('a', { className: 'fas fa-external-link-alt small', href: props.data.url, target: '_blank' }),
    )
}


Trellos.Search.MarkedText = (props) => {
    let words = props.words || [];
    let regstr = "([a-zA-Zа-яА-ЯёЁ]*(" +
        words.join("|")
        + ")[a-zA-Zа-яА-ЯёЁ]*)";
    const r = new RegExp(regstr, "gmi");
    let html = props.children;
    if (props.replaceNewline) html = html.replace(/\n/gm, '<br>');
    html = html.replace(r, '<mark>$1</mark>')
    let opts = {
        ...props,
        words: null,
        children: null,
        replaceNewline: null,
        dangerouslySetInnerHTML: { __html: html }
    }
    delete opts.replaceNewline;
    return e('span', opts);
}