'use strict'

window.onload = () => { ReactDOM.render(e(Trellos.App), document.getElementById('trellos')); }

const e = React.createElement;
const BS = ReactBootstrap;


const get = function (props, name, def) {
    if (props == null) return def;
    if (typeof (props) != 'object') return def;
    if (!props.hasOwnProperty(name)) return def;
    return props[name];
}

if (!window['Trellos']) window['Trellos'] = {};

if (!Trellos.Plugins) Trellos.Plugins = {}; // { name: Plugin }
/* Module {
    renderTab: renderProp
    renderPlugin: renderProp
} */


/* utils */

Trellos.Form = {};

Trellos.nbsp = '\u00A0';

Trellos.utils = {}

Trellos.utils.getCookie = (name) => {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

Trellos.utils.setCookie = (name, value, options = {}) => {
    if (options.expires && options.expires.toUTCString) {
        options.expires = options.expires.toUTCString();
    }
    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }
    document.cookie = updatedCookie;
}

// declOfNum(number, ['задача', 'задачи', 'задач']));
Trellos.utils.declOfNum = (number, titles) => {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

Trellos.utils.unionArrays = (arr1, arr2) => {
    let arr3 = arr1.concat(arr2);
    let arr4 = arr3.filter(function (item, pos) {
        return arr3.indexOf(item) == pos;
    })
    return arr4;
}

// https://github.com/jimmywarting/StreamSaver.js
Trellos.utils.downloadAsFile = function (filename, text) {
    const blob = new Blob(Array.from(text))
    const fileStream = streamSaver.createWriteStream(filename, {
        size: blob.size // Makes the procentage visiable in the download
    })

    // One quick alternetive way if you don't want the hole blob.js thing:
    // const readableStream = new Response(
    //   Blob || String || ArrayBuffer || ArrayBufferView
    // ).body
    const readableStream = blob.stream()

    // more optimized pipe version
    // (Safari may have pipeTo but it's useless without the WritableStream)
    if (window.WritableStream && readableStream.pipeTo) {
        return readableStream.pipeTo(fileStream)
            .then(() => { })
    }

    // Write (pipe) manually
    window.writer = fileStream.getWriter()

    const reader = readableStream.getReader()
    const pump = () => reader.read()
        .then(res => res.done
            ? writer.close()
            : writer.write(res.value).then(pump))

    pump()
}


Trellos.utils.rndstr = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/* end utils */


Trellos.searchCache = new Cache({ storage: new ObjectStorage() });

Trellos.config = {
    minWordLengthToStem: 4,
    minQueryLength: 2,
    searchCacheTtl: 1000 * 60,
    searchPageSize: 30,
    cookieName: 'trellosjs1',
    cookieTtle: 60 * 60 * 24 * 365
}

Trellos.getInitalState = () => {
    const globalKey = 'initialState';
    let state = get(Trellos, globalKey);
    if (state != undefined) return state;
    state = null;
    try {
        state = JSON.parse(decodeURIComponent(atob(
            Trellos.utils.getCookie(Trellos.config.cookieName)
        )));
    } catch { }


    const ps = new URLSearchParams(document.location.search);
    Array.from(ps.keys()).forEach(queryKey => {
        try {
            let dataItem = JSON.parse(decodeURIComponent(atob(ps.get(queryKey))));
            state = state || {};
            state[queryKey] = dataItem;
        } catch {
            state = state || {};
            state[queryKey] = decodeURIComponent(ps.get(queryKey));
        }
    });
    Trellos[globalKey] = Object.assign({}, state);
    return Trellos[globalKey];
}

// https://help.trello.com/article/759-getting-the-time-a-card-or-board-was-created
Trellos.convertTrelloIdToTime = function (id) {
    return moment(1000 * parseInt(id.substring(0, 8), 16));
}


Trellos.trelloGetRecursive = async function (path, parameters, chunkCallback) {
    let allData = []; // Container for all objects
    let chunkIndex = 0;

    // Loading function
    let recursiveLoad = async function (before) {
        // Trello returns only 1000 newest items.
        // 'Before' is need to filter earlier chunk.
        parameters['before'] = before;
        parameters['limit'] = 1000; // max limit of trello
        let data = await window.Trello.get(path, parameters);
        if (data.length > 0) { // if it is non empty chunk
            allData = allData.concat(data);
            // find id for 'before' parameter
            let minId = data.map(x => x.id).reduce((p, n) => n < p ? n : p);
            if (minId) {
                if (chunkCallback) chunkCallback(chunkIndex, data, allData.length);
                chunkIndex++;
                await recursiveLoad(minId); // load next chunk
            }
        } else {
            // empty return from trello, it mean than all data loaded
        }
    }

    const earliestId = function (list) {
        if (!list || !list.length) return "";
        let min = list[0].id;
        for (let i = 0; i < list.length; i++) {
            if (list[i].id < min) min = list[i].id;
        }
        return min;
    }
    // ---------------

    await recursiveLoad(parameters.before || ""); // start loading
    return allData;
}

Trellos.loadMeBoards = async function (filter) {
    let opts = {
        fields: 'id,name,shortUrl,closed',
        organization: false,
        lists: 'all',
        filter: 'all',
        labels: 'none',
        memberships: 'none',
        organization_fields: 'none',
        members: "none"
    };
    Object.assign(opts, filter);
    return await window.Trello.get('member/me/boards', opts);
}


Trellos.App = function (props) {
    const [validAuth, setValidAuth] = React.useState(false);
    const [me, setMe] = React.useState(null);
    const [tab, setTab] = React.useState('search');
    let [appState, setAppState] = React.useState(null);

    const authorize = function () {
        window.Trello.authorize({
            type: 'popup',
            name: 'Trellos',
            scope: {
                read: 'true',
                write: 'true',
                account: 'true',
            },
            expiration: 'never',
            success: async () => {
                try {
                    window.Trello.get('member/me', { fields: 'id,fullName,url,username' },
                        (data) => {
                            setMe(data);
                        }
                    );
                } catch {
                    delete localStorage['trello_token'];
                    setValidAuth(false);
                }
                setValidAuth(true);
            },
            error: () => {
                delete localStorage['trello_token'];
                setValidAuth(false);
            }
        });
    }

    const onChangeTab = function (tab) {
        setTab(tab);
        if (tab != 'settings') onUpState('tab', tab);
    }

    React.useEffect(() => {
        if (!validAuth) {
            authorize();
            return
        }
    })

    React.useEffect(() => { // init
        let state = Trellos.getInitalState();
        setTab(get(state, 'tab', 'search'));
        setAppState(state);
    }, [])

    const onUpState = (name, data) => {
        let s = Object.assign({}, appState || {});
        s[name] = data;
        setAppState(s);
        saveState(s);
    }

    const saveState = (state) => {
        if (appState == null && !state) return;
        let o = Object.assign({}, state || appState);
        if (o.search && o.search.query) delete o.search.query;
        const s = JSON.stringify(o);
        Trellos.utils.setCookie(Trellos.config.cookieName, btoa(encodeURIComponent(s)), { 'max-age': Trellos.config.cookieTtl });
    }

    console.log('render app');
    return e(BS.Container, { className: 'my-3' },
        validAuth ? null : e(Trellos.Auth.Form, { onAuth: authorize }),
        me ? e(Trellos.Nav, { activeKey: tab, onChangeTab: onChangeTab }) : null,
        Object.keys(Trellos.Plugins).map((pName) => {
            console.log('plugin', pName);
            return tab == pName ? e(React.Fragment, { key: pName }, Trellos.Plugins[pName].plugin({
                me: me,
                onUpState: onUpState
            })) : null
        }),
        // me && tab == 'search' ? e(Trellos.Search, {
        //     me: me, onUpState: onUpState
        // }) : null,
        // me && tab == 'export' ? e(Trellos.Export, { me: me, onUpState: onUpState }) : null,
        // me && tab == 'settings' ?
        //     e(React.Fragment, { key: 'settings' }, e(Trellos.Settings, { me: me, onUpState: onUpState }))
        //     : null
    );
}



Trellos.Back = function (props) {
    const onClick = (event) => {
        event.preventDefault();
        props.onClick();
    }

    return e(props.as || 'h4', { className: 'mb-4' },
        e('a', { href: '#', onClick: onClick, style: { textDecoration: 'none' }, className: "mr-2" }, '←'),
        props.children
    );
}

Trellos.Muted = function (props) {
    let opts = {};
    Object.assign(opts, props);
    opts.className = 'text-muted ' + opts.className;
    delete opts['as'];
    return e(props.as || 'small', opts, props.children);
}

Trellos.Auth = function () { return null; }

Trellos.Auth.Form = function (props) {
    return e('div', {},
        e(BS.Alert, { variant: 'danger' }, 'Требуется вход в Trello'),
        e(BS.Button, { onClick: props.onAuth }, 'Войти'),
        e('div', { className: 'mt-2' },
            e(Trellos.Muted, null, 'Разрешите всплывающие окна на странице')
        )
    )
}


Trellos.Nav = function (props) {
    const onSelect = function (key) {
        if (key != props.activeKey) props.onChangeTab(key);
    }

    return e(BS.Nav, { onSelect: onSelect, activeKey: props.activeKey, className: 'mb-4', variant: 'tabs' },
        Object.keys(Trellos.Plugins).map(pName => e(React.Fragment, { key: pName }, Trellos.Plugins[pName].tab())),
        e(BS.Nav.Item, {}, e(BS.Nav.Link, { eventKey: 'settings' },
            e('i', { className: 'fas fa-cog d-inline-block d-sm-none mx-2' }),
            e('span', { className: 'd-none d-sm-inline-block' }, 'Настройки')
        )),
    );
}

Trellos.Spinner = function (props) {
    let opts = {};
    Object.assign(opts, props);
    Object.assign(opts, { variant: 'dark', size: 'sm', animation: 'border' });
    return e(BS.Spinner, opts);
}


Trellos.Settings = function (props) {
    const onResetState = (event) => {
        Trellos.utils.setCookie(Trellos.config.cookieName, null, { 'max-age': -1 });
        document.location.href = document.location.origin + document.location.pathname;
    }

    return e(BS.Form, null,
        e(BS.Form.Group, null,
            e(Trellos.Settings.Profile, { me: props.me })
        ),
        e(BS.Form.Group, null,
            e(BS.Button, { variant: 'link', className: 'p-0', onClick: onResetState }, 'Сбросить сохраненное состояние')
        )
    )
}


Trellos.Settings.Profile = function (props) {
    const deauthorize = () => {
        delete localStorage['trello_token'];
        Trellos.utils.setCookie(Trellos.config.cookieName, null, { 'max-age': -1 })
        window.Trello.deauthorize();
        document.location.reload();
    }

    return e('div', null,
        `Пользователь Trello: ${props.me.fullName} (`,
        e('a', { href: props.me.url, target: '_blank' }, props.me.username),
        `) `,
        e('a', { href: "#", onClick: deauthorize, className: 'text-danger d-inline-block' }, 'Выйти')
    );
}



Trellos.TrelloLabel = (props) => {
    const styles = {
        green: { backgroundColor: '#61bd4f66', color: '#666' },
        yellow: { backgroundColor: '#f2d60066', color: '#666' },
        orange: { backgroundColor: '#ff9f1a66', color: '#666' },
        red: { backgroundColor: '#eb5a4666', color: '#666' },
        purple: { backgroundColor: '#c366e066', color: '#666' },
        blue: { backgroundColor: '#0079bf66', color: '#666' },
        sky: { backgroundColor: '#00c2e066', color: '#666' },
        lime: { backgroundColor: '#51e89866', color: '#666' },
        pink: { backgroundColor: '#ff78cb66', color: '#666' },
        black: { backgroundColor: '#35526366', color: '#666' },
        none: { border: '1px solid #b3bec488', color: 'gray' }
    }

    let opts = {};
    Object.assign(opts, props);
    opts.style = get(styles, props.variant, styles.none);
    opts.style.borderRadius = "10px";
    opts.style.fontSize = '0.6rem';
    opts.className = 'd-inline-block px-2 ' + (opts.className || '');
    delete opts.variant;
    return e('span', opts, props.children);
}

Trellos.IconLink = (props) => {
    let opts = Object.assign({}, props);
    opts.className = 'icon-link ' + (opts.className || '');
    delete opts.variant;
    delete opts.children;

    return e('a', opts,
        e('span', { className: `mr-1 ${props.variant}` }),
        props.children
    )
}


Trellos.Form.Period = function (props) {
    const makeObject = (source) => {
        const m = moment(source);
        let ob = {
            m: m,
            value: source && m.isValid() ? m.format("DD.MM.YYYY") : null
        }
        ob.parsed = ob.value && m.isValid() ? m.format('DD.MM.YYYY') : Trellos.nbsp;
        ob.valid = !ob.value || m.isValid();
        return ob;
    }

    const [since, setSince] = React.useState(makeObject(props.since));
    const [before, setBefore] = React.useState(makeObject(props.before));

    const onChange = (event) => {
        const cName = event.target.name;
        let s = cName == 'since' ? { value: event.target.value.trim() } : since;
        let b = cName == 'before' ? { value: event.target.value.trim() } : before;
        [s, b] = [s, b].map((ob, i) => {
            let m = moment(ob.value, 'DD.MM.YYYY');
            return makeObject(m);
        });

        if (s.m && b.m && s.value && b.value && s.valid && b.valid && s.m > b.m) {
            s.valid = false;
            b.valid = false;
        }
        setSince(s);
        setBefore(b);
        if (props.onChange) {
            props.onChange(s.m.isValid() ? s.m.format("YYYY-MM-DD") : null, b.m.isValid() ? b.m.format("YYYY-MM-DD") : null);
        }
    }

    let sinceElId = props.id ? props.id + '-since' : null;
    let beforeElId = props.id ? props.id + '-before' : null;

    let rProps = Object.assign({}, props);
    delete rProps['children'];
    delete rProps['onChange'];
    delete rProps['since'];
    delete rProps['before'];

    return e(BS.Row, rProps,
        e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
            e(BS.Form.Control, {
                placeholder: 'от (дд.мм.гггг)', name: 'since',
                onChange: onChange,
                isInvalid: !since.valid,
                defaultValue: since.value,
                id: sinceElId
            }),
            e(Trellos.Muted, {}, since.parsed)
        ),
        e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2, className: 'pl-0' },
            e(BS.Form.Control, {
                placeholder: 'до (дд.мм.гггг)', name: 'before',
                onChange: onChange,
                isInvalid: !before.valid,
                defaultValue: before.value,
                id: beforeElId
            }),
            e(Trellos.Muted, {}, before.parsed)
        )
    )

}

/* SEARCH PLUGIN ******************** */


Trellos.Search = function (props) {
    const [searchProgress, setSearchProgress] = React.useState(false);
    const [boards, setBoards] = React.useState(null);
    const [searchResult, setSearchResult] = React.useState(null);

    React.useEffect(() => {
        if (boards !== null) return;

        Trellos.loadMeBoards().then(data => {
            setBoards(data.sort((a, b) => {
                let alpha = [a.name, b.name].sort();
                let closed = 0;
                if (a.closed && !b.closed) closed = 1;
                if (!a.closed && b.closed) closed = -1;
                return closed === 0 ? alpha : closed;
            }))
        })
    })

    // finds stemmed words in stemmed text and returns finded
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

    const onSearch = async (filter) => {
        if (searchProgress) return;
        setSearchProgress(true);
        setSearchResult(null);

        let cleanFilter = Object.assign({}, filter);
        let upState = Object.assign({}, filter);
        delete upState.query;
        delete upState.since;
        delete upState.before;

        props.onUpState('search', upState);

        filter.stemQuery = Porter.stemText(filter.query, Trellos.config.minWordLengthToStem);
        if (filter.allBoards) filter.boards = boards.map(b => b.id);

        let cardsData = [];
        for (let i = 0; i < filter.boards.length; i++) {
            let idBoard = filter.boards[i];
            let cards = Trellos.searchCache.getItem(idBoard);
            if (cards == null) {
                cards = await Trellos.trelloGetRecursive(`boards/${idBoard}/cards`, {
                    filter: "all",
                    fields: "id,name,desc,idBoard,idList,labels,closed,shortLink,shortUrl,dateLastActivity",
                    members: "true",
                    members_fields: "id,fullName,username"
                })
                Trellos.searchCache.setItem(idBoard, cards, Trellos.config.searchCacheTtl)
            }
            cardsData.push(cards);
        };

        let searchResult = [];


        const momentSince = filter.since ? moment(filter.since) : null;
        const momentBefore = filter.before ? moment(filter.before) : null;
        if (momentBefore) {
            momentBefore.se
        }

        cardsData.forEach(async (cards) => {
            cards.forEach(card => {
                if (!filter.allowArchive && card.closed) return;
                let isOk = true;
                const momentCreated = Trellos.convertTrelloIdToTime(card.id);

                if (momentSince && momentSince.isValid()) {
                    isOk = momentCreated.isSameOrAfter(momentSince, 'day');
                }
                if (isOk && momentBefore && momentBefore.isValid()) {
                    isOk = momentCreated.isSameOrBefore(momentBefore, 'day');
                }
                if (!isOk) return;

                card.stemName = Porter.stemText(card.name, Trellos.config.minWordLengthToStem);
                card.stemDesc = Porter.stemText(card.desc, Trellos.config.minWordLengthToStem);
                // search by card name
                let findedWords = findText(filter.stemQuery, card.stemName) || [];
                isOk = filter.allWords ? findedWords.length == filter.stemQuery.length : findedWords.length > 0;
                // search by card desc if it needed
                if (!isOk) {
                    findedWords = Trellos.utils.unionArrays(findedWords, findText(filter.stemQuery, card.stemDesc) || []);
                    isOk = filter.allWords ? findedWords.length == filter.stemQuery.length : findedWords.length > 0;
                }
                if (!isOk) return;
                card.board = boards.find(b => b.id == card.idBoard);
                card.list = card.board.lists.find(l => l.id == card.idList);
                card.finded = findedWords;
                searchResult.push(card);
            })
        })

        searchResult.sort(filter.sortMode == 'created' ? cardCreatedComparer : cardLastActivityComparer);
        searchResult.hash = btoa(encodeURIComponent(Trellos.utils.rndstr()));

        const linkState = JSON.stringify(cleanFilter);
        searchResult.link = document.location.origin + document.location.pathname +
            "?search=" + btoa(encodeURIComponent(linkState)) +
            "&tab=search";
        setSearchResult(searchResult);
        setSearchProgress(false);
    }

    return boards == null ? e(Trellos.Spinner) :
        e('div', null,
            e(Trellos.Search.Form, {
                boards: boards, onSubmit: onSearch, inProgress: searchProgress,
            }),
            !searchProgress && searchResult ? e(Trellos.Search.Result, { data: searchResult }) : null
        );
}

Trellos.Plugins['search'] = {
    plugin: Trellos.Search,
    tab: (props) => {
        return e(BS.NavItem, null, e(BS.Nav.Link, { eventKey: 'search' },
            e('i', { className: 'fas fa-search d-inline-block d-sm-none mx-2' }),
            e('span', { className: 'd-none d-sm-inline-block' }, 'Поиск')
        ))
    }
};

Trellos.Search.Result = function (props) {
    const [page, setPage] = React.useState(0);
    const [hash, setHash] = React.useState(null);

    const onChangePage = (pageIndex) => {
        if (pageIndex == page) return;
        setPage(pageIndex);
        document.getElementById('trellos-search-result')
            .scrollIntoView({ block: "start", behavior: "smooth", inline: "nearest" });
    }

    React.useEffect(() => {
        if (hash != props.data.hash) {
            setPage(0)
            setHash(props.data.hash)
        }
    });

    const dataPage = props.data.slice(page * Trellos.config.searchPageSize, (page + 1) * Trellos.config.searchPageSize)
    let pageCount = Math.ceil(props.data.length / Trellos.config.searchPageSize);
    let pages = [];
    for (let i = 0; i < pageCount; i++) {
        pages.push(e(BS.Pagination.Item, { key: i, active: i == page, onClick: () => { onChangePage(i) } }, `${i + 1}`));
        if (i == 9) {
            pages.push(e(BS.Pagination.Ellipsis, { key: '...' }))
            break;
        }
    }

    return e('div', { className: 'mt-4', id: 'trellos-search-result' },
        e(Trellos.Search.Result.Head, { data: props.data }),
        dataPage.map((card, i) => e(Trellos.Search.Result.Card, {
            key: card.id,
            card: card,
            index: page * Trellos.config.searchPageSize + i
        })),
        e(BS.Pagination, null,
            pages.length > 1 ? pages : null
        ),
        pageCount > 10 ? e(Trellos.Muted, null, 'Показаны первые 10 страниц') : null
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


    const styles = {
        cardCreatedAt: {
            fontSize: '60%'
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
                    return e(Trellos.TrelloLabel, { key: label.id + Trellos.utils.rndstr(), variant: label.color, className: 'mr-1' }, label.name)
                })
            ),
            e('span', { className: "text-muted", title: "Время создания", style: styles.cardCreatedAt },
                Trellos.convertTrelloIdToTime(props.card.id).format('DD.MM.YYYY hh:mm')
            )
        ),
        e(BS.Card.Subtitle, null,
            e(Trellos.Search.MarkedText, { words: props.card.finded }, props.card.name),
            e('a', { className: 'text-secondary ml-3 fab fa-trello', target: '_blank', href: props.card.shortUrl })
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
        searchLinkBlock: { display: 'inline-block' },
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

    const onCopySearchLink = (event) => {
        event.preventDefault();
        const inp = document.getElementById('trellos-search-result-link');
        inp.focus();
        inp.select();
        document.execCommand("copy");
        const btn = event.target.closest('a');
        btn.className += ' text-success';
        inp.blur();
        setTimeout(function () {
            btn.className = btn.className.replace(/ text-success/, '');
        }, 1500);
    }

    if (!props.data.length) return e(BS.Alert, { variant: 'secondary' }, 'Ничего не найдено')
    return e('div', { className: 'mb-4' },
        e(Trellos.Muted, { className: 'mr-5' },
            Trellos.utils.declOfNum(props.data.length, ["Найдена", "Найдено", "Найдено"]),
            ` ${props.data.length} `,
            Trellos.utils.declOfNum(props.data.length, ["карточка", "карточки", "карточек"])
        ),
        e('small', { style: styles.searchLinkBlock },
            e('input', {
                id: 'trellos-search-result-link', style: styles.searchLinkInput,
                value: props.data.link, onChange: (event) => { event.preventDefault(); }
            }),
            e(Trellos.IconLink, {
                href: props.data.link, variant: 'far fa-copy',
                onClick: onCopySearchLink
            }, 'Копировать ссылку на этот поиск'),
            e('a', { className: 'ml-4 fas fa-external-link-alt', href: props.data.link, target: '_blank' }),
        ),

    )
}

Trellos.Search.Form = function (props) {
    const [allBoards, setAllBoards] = React.useState(false);
    let [validQuery, setValidQuery] = React.useState(true);
    let [validForm, setValidForm] = React.useState(false);
    let [initState, setInitState] = React.useState(get(Trellos.getInitalState(), 'search', null));
    let [period, setPeriod] = React.useState({
        since: get(initState, 'since', null),
        before: get(initState, 'before', null)
    });

    React.useEffect(() => { // init effect
        if (get(initState, 'allBoards', false)) setAllBoards(true);
        if (get(initState, 'query', '') && validateForm()) {
            validForm = true;
            validQuery = true;
            onSubmit();
        }
    }, []);

    const onSelectBoard = (event) => {
        const cb = event.target.closest('input[type="checkbox"]');
        if (!cb) return;
        if (cb.value == 'all') {
            setAllBoards(cb.checked);
        }
        validateForm();
    }

    const validateQuery = (event) => {
        const val = event.target.value.trim();
        let valid = val.length >= Trellos.config.minQueryLength;
        valid = valid && Porter.stemText(val, Trellos.config.minWordLengthToStem).length > 0;
        setValidQuery(valid);
        validateForm();
    }

    const onChangePeriod = (since, before) => {
        setPeriod({ since: since, before: before });
    }

    const validateForm = () => {
        let query = document.getElementById('trellos-search-query').value.trim();
        let validQ = query.length >= Trellos.config.minQueryLength;
        validQ = validQ && Porter.stemText(query, Trellos.config.minWordLengthToStem).length > 0;
        setValidQuery(validQ);

        let isAllBoards = document.getElementById('trellos-search-all-boards').checked;
        let hasCheckedBoards = document.querySelectorAll('#trellos-search-form input[name="trellos-search-board"]:checked').length > 0;
        let ok = validQ && (isAllBoards || hasCheckedBoards);
        setValidForm(ok);
        return ok;
    }

    const onSubmit = (event) => {
        if (event) event.preventDefault();
        if (!validForm || !validQuery) return false;
        props.onSubmit({
            query: document.getElementById('trellos-search-query').value.trim(),
            allWords: document.getElementById('trellos-search-all-words').checked,
            allowArchive: document.getElementById('trellos-search-archive').checked,
            sortMode: document.getElementById('trellos-search-sort-alt').checked ? 'created' : 'modified',
            allBoards: document.getElementById('trellos-search-all-boards').checked,
            boards: Array.from(document.querySelectorAll('#trellos-search-form input[name="trellos-search-board"]:checked'))
                .map(x => x.value),
            since: get(period, 'since', null),
            before: get(period, 'before', null)
        })
    }

    return e(BS.Form, { onSubmit: onSubmit, id: 'trellos-search-form' },
        e(BS.Form.Group, null,
            e(BS.Form.Control, {
                type: 'text', placeholder: 'Что ищем?', size: 'lg', id: 'trellos-search-query',
                onChange: validateQuery, isInvalid: !validQuery,
                defaultValue: get(initState, 'query', '')
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Все слова',
                defaultChecked: get(initState, 'allWords', true), id: 'trellos-search-all-words'
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Искать в архиве',
                id: 'trellos-search-archive', defaultChecked: get(initState, 'allowArchive', false)
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Сортировка по созданию',
                id: 'trellos-search-sort-alt', defaultChecked: get(initState, 'sortMode', 'modified') == 'created'
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true, style: { fontWeight: 'bold' }, defaultChecked: false,
                id: 'trellos-search-all-boards', value: 'all', label: 'Все доски',
                onChange: onSelectBoard, defaultChecked: get(initState, 'allBoards', false)
            }),
            allBoards ? null : props.boards.map(board => {
                return e(BS.Form.Check, {
                    inline: true, type: 'checkbox', label: board.name, name: 'trellos-search-board',
                    id: `trellos-search-board-${board.id}`, value: board.id, key: board.id,
                    onChange: onSelectBoard,
                    defaultChecked: Boolean(get(initState, 'boards', []).find(b => b == board.id))
                })
            })
        ),
        e(BS.Form.Group, { className: 'mb-0' }, 'Дата создания'),
        e(BS.Form.Group, null,
            e(Trellos.Form.Period, {
                since: get(initState, 'since', null),
                before: get(initState, 'before', null),
                onChange: onChangePeriod
            })
        ),
        e(BS.Form.Group, { className: 'my-4' },
            e(BS.Button, {
                disabled: !validForm || props.inProgress,
                type: 'submit', size: 'lg', className: 'px-4 mr-3',
                id: 'trellos-search-form-button'
            },
                props.inProgress ? e(Trellos.Spinner, { className: 'mr-2' }) : null,
                props.inProgress ? 'Поиск…' : 'Найти'
            )
        )
    );
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
    return e('span', { dangerouslySetInnerHTML: { __html: html } });
}
