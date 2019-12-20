'use strict'

window.onload = () => { ReactDOM.render(e(Trellos), document.getElementById('trellos')); }

const e = React.createElement;
const BS = ReactBootstrap;

const get = function (props, name, def) {
    if (props == null) return def;
    if (typeof (props) != 'object') return def;
    if (!props.hasOwnProperty(name)) return def;
    return props[name];
}

// declOfNum(number, ['задача', 'задачи', 'задач']));
const declOfNum = (number, titles) => {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

const Trellos = function (props) {
    const [validAuth, setValidAuth] = React.useState(false);
    const [me, setMe] = React.useState(null);
    const [tab, setTab] = React.useState('search');

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
    }

    React.useEffect(() => {
        if (!validAuth) authorize();
    })

    return e(BS.Container, { className: 'my-3' },
        validAuth ? null : e(Trellos.Auth.Form, { onAuth: authorize }),
        me ? e(Trellos.Nav, { activeKey: tab, onChangeTab: onChangeTab }) : null,
        me && tab == 'search' ? e(Trellos.Search, { me: me }) : null,
        me && tab == 'settings' ? e(Trellos.Settings, { me: me }) : null,
        me && tab == 'export' ? e(Trellos.Export, { me: me }) : null
    );
}


Trellos.preferences = {
    minTextLengthToStem: 4,
    minQueryLength: 1
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
        } else { // empty return from trello, it mean than all data loaded
            // returns allData but last loading other parameters
        }
    }

    // returns most oldest trello object id
    // objects from trello may be unsorted because it compare all items
    // id of trello object is mongoDB-ID. it can be compared
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

// https://github.com/jimmywarting/StreamSaver.js
Trellos.downloadAsFile = function (filename, text) {
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
            .then(() => console.log('done writing file ' + filename))
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
        e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'search' },
            e('i', { className: 'fas fa-search d-inline-block d-sm-none mx-2' }),
            e('span', { className: 'd-none d-sm-inline-block' }, 'Поиск')
        )),
        e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'export' },
            e('i', { className: 'fas fa-file-download d-inline-block d-sm-none mx-2' }),
            e('span', { className: 'd-none d-sm-inline-block' }, 'Экспорт')
        )),
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
    return e(BS.Form, null,
        e(BS.Form.Group, null,
            e(Trellos.Settings.Profile, { me: props.me })
        ),
        // e(BS.Form.Group, null,
        //     e(BS.Form.Label, null, 'Время кеширования карточек для поиска, секунд'),
        //     e(BS.Form.Control, { id: 'trellos-settings-cache-time', type: 'number', style: { width: 'unset' } }),
        //     e(Trellos.Muted, null, 'Если 0, то карточки не кешируются')
        // )
    )
}


Trellos.Settings.Profile = function (props) {
    const deauthorize = () => {
        delete localStorage['trello_token'];
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


Trellos.Export = function (props) {
    const [board, setBoard] = React.useState(null);
    const [exportData, setExportData] = React.useState(null);

    const onSelectBoard = (newBoard) => {
        setBoard(newBoard);
    }

    const onExport = (filter) => {
        const listOfCard = (card) => {
            return board.lists.find(l => l.id == card.idList);
        }

        const dateFilter = (str, addDays) => {
            let m = moment(str, 'DD.MM.YYYY');
            if (!m.isValid()) return '';
            if (addDays) m.add(addDays, 'day');
            return m.format('YYYY-MM-DD');
        }

        if (window.trellos_debug) console.log('Trellos', 'Export by filter', filter);

        Trellos.trelloGetRecursive(`boards/${board.id}/cards`, {
            filter: filter.visibility ? "visible" : "all",
            fields: "id,name,idBoard,idList,labels,closed,shortLink,shortUrl,dateLastActivity",
            members: "true",
            members_fields: "id,fullName,username",
            since: dateFilter(filter.since),
            before: dateFilter(filter.before, 1)
        }).then((data) => {
            let csv = [[
                'Card key',
                'Card name',
                'Board name',
                'List name',
                'Members',
                'Labels',
                'Card closed',
                'List closed',
                'Board closed',
                'Card url',
                'Card last activity',
                'Card created date',
                'Card created time',
                'idCard',
                'idList',
                'idBoard'
            ]];
            data.map((card, iter) => {
                if (filter.lists.length && !filter.lists.find(idList => idList == card.idList)) return;
                const list = listOfCard(card);
                const created = moment(1000 * parseInt(card.id.substring(0, 8), 16));
                // https://help.trello.com/article/759-getting-the-time-a-card-or-board-was-created
                csv.push([
                    card.shortLink,
                    card.name,
                    board.name,
                    get(list, 'name', ''),
                    card.members.map(m => m.fullName).join(','),
                    card.labels.map(l => l.name || l.color).join(","),
                    card.closed ? 'closed' : '',
                    get(list, 'closed', '') ? 'closed' : '',
                    board.closed ? 'closed' : '',
                    card.shortUrl,
                    moment(card.dateLastActivity).format('DD.MM.YYYY HH:MM'),
                    created.format("DD.MM.YYYY"),
                    created.format("DD.MM.YYYY HH:mm"),
                    card.id,
                    get(list, 'id', ''),
                    board.id
                ]);
            })
            setExportData(csv);
        });
    }

    return e('div', null,
        e(Trellos.Export.Boards, { idBoard: get(board, 'id'), onChange: onSelectBoard }),
        Boolean(board) ? e('div', null,
            e(Trellos.Back, { onClick: () => { setBoard(null); setExportData(null); } },
                board.name,
                e('a', { href: board.shortUrl, target: "_blank", className: 'ml-2  text-secondary' },
                    e('small', { className: 'fab fa-trello' })
                )
            ),
            exportData ? null : e(Trellos.Export.Form, { board: board, onSubmit: onExport }),
            exportData ? e(Trellos.Export.Download, { board: board, data: exportData }) : null
        ) : null
    );
}

Trellos.Export.Download = function (props) {
    const csvEscape = function (str) {
        return '"' + String(str).replace(/"/gmi, '""')
            .replace(/\t/gmi, ' ')
            .replace(/[\n\r]/gmi, '')
            .replace(/&#8203;/gmi, '')
            + '"';
    }

    const onDownload = (event) => {
        event.preventDefault();
        const btn = event.target.closest("button");
        if (!btn) return;
        let text = props.data.map(row => {
            return row.map(cell => {
                return csvEscape(cell)
            }).join(",");
        }).join("\n");
        if (btn.id == 'trellos-export-mac') text = '\ufeff' + text;
        Trellos.downloadAsFile(`export-${props.board.name}.csv`, text);
    }

    return e('div', null,
        e('div', { className: 'mb-3' },
            (`${props.data.length - 1} ` + declOfNum(props.data.length - 1, ['карточка', 'карточки', 'карточек']))
        ),
        e('i', {
            className: 'fas fa-file-download mr-1 text-muted', style: {
                fontSize: '130%', verticalAlign: 'middle'
            }
        }),
        e(Trellos.Muted, { as: 'strong', className: 'mr-3', style: { verticalAlign: 'middle' } }, 'CSV'),
        e(BS.Button, { variant: "outline-primary", className: 'mr-3', id: "trellos-export-mac", onClick: onDownload },
            e('i', { className: 'fab fa-apple mr-1' }), "Mac"),
        e(BS.Button, { variant: "outline-primary", onClick: onDownload, id: "trellos-export-win" },
            e('i', { className: 'fab fa-windows mr-1' }), "Windows"),
    )
}

Trellos.Export.Boards = function (props) {
    const [boards, setBoards] = React.useState(null);

    React.useEffect(() => {
        if (boards !== null) return; // boards are already loaded

        Trellos.loadMeBoards().then(data => {
            setBoards(data.sort((a, b) => {
                let alpha = [a.name, b.name].sort();
                let closed = 0;
                if (a.closed && !b.closed) closed = 1;
                if (!a.closed && b.closed) closed = -1;
                return closed === 0 ? alpha : closed;
            }))
        })
    });

    const onSelect = (key) => {
        if (key != props.idBoard) props.onChange(boards.find(b => b.id == key));
    }

    // ----
    if (props.idBoard) return null; // hide when has selected

    return e('div', null,
        boards == null ? e(Trellos.Spinner) : null,
        boards != null ?
            e(BS.Nav, { activeKey: props.idBoard, className: 'flex-column', onSelect: onSelect },
                boards.map(board => {
                    return e(BS.Nav.Item, { key: board.id },
                        e(BS.Nav.Link, {
                            eventKey: board.id,
                            className: (board.closed ? 'text-secondary' : null) + ' pl-0 pt-0'
                        }, board.name)
                    )
                })
            ) : null
    );
}

Trellos.Export.Form = function (props) {
    const [visibility, setVisibility] = React.useState(true);
    const [period, setPeriod] = React.useState(null);
    const [view, setView] = React.useState('form');

    const onChangePeriod = (since, before) => {
        setPeriod({ since: since, before: before, valid: since && before && since.valid && before.valid });
    }

    const onSubmit = (event) => {
        const pdate = (ctrl, name) => {
            if (!ctrl || !ctrl[name]) return '';
            return String(ctrl[name].value);
        }

        event.preventDefault();
        setView('progress');

        let domLists = document.querySelectorAll("input[name='trellos-export-list']:checked"
            + (visibility ? ":not(:disabled)" : ""));

        let e = {
            visibility: visibility,
            since: pdate(period, 'since'),
            before: pdate(period, 'before'),
            lists: !domLists ? [] : Array.from(domLists).map(l => l.id)
        }
        props.onSubmit(e);
    }

    return e(BS.Form, { onSubmit: onSubmit },
        e(BS.FormGroup, null,
            e(BS.Form.Check, {
                inline: true, id: "visible-cards", label: "Видимые карточки",
                type: 'radio', name: 'visibility', defaultChecked: true,
                onClick: () => { setVisibility(true) }
            }),
            e(BS.Form.Check, {
                inline: true, id: "all-cards", label: "Все карточки",
                type: 'radio', name: 'visibility',
                onClick: () => { setVisibility(false) }
            })
        ),
        e(Trellos.Export.Form.Lists, { board: props.board, onlyVisible: visibility }),
        e(Trellos.Export.Form.Period, { onChange: onChangePeriod }),
        e(BS.Button, {
            type: 'submit', disabled: (period && !period.valid) || view == 'progress'
        },
            view == 'progress' ? e(Trellos.Spinner, { className: 'mr-2' }) : null,
            'Экспорт в CSV')
    )
}

Trellos.Export.Form.Lists = function (props) {
    return e(BS.Form.Group, null,
        props.board.lists
            .sort((a, b) => {
                let s = 0;
                if (a.closed && !b.closed) return 1;
                if (b.closed && !a.closed) return -1;
            }).map((list) => {
                if (props.onlyVisible && list.closed) return null;
                return e(BS.Form.Check, {
                    key: list.id,
                    label: list.name,
                    type: 'checkbox',
                    id: list.id,
                    className: (list.closed ? 'text-muted' : null) + ' mb-1',
                    name: 'trellos-export-list'
                })
            }),
        e(Trellos.Muted, null, 'Если списки не выбраны, то выгружается всё')
    )
}


Trellos.Export.Form.Period = function (props) {
    const [since, setSince] = React.useState({ value: '', parsed: '\u00A0', valid: true });
    const [before, setBefore] = React.useState({ value: '', parsed: '\u00A0', valid: true });
    const [periodValid, setPeriodValid] = React.useState(true);

    const onChange = (event) => {
        const cName = event.target.name;
        let s = cName == 'since' ? { value: event.target.value.trim() } : since;
        let b = cName == 'before' ? { value: event.target.value.trim() } : before;
        [s, b] = [s, b].map((ob, i) => {
            let m = moment(ob.value, 'DD.MM.YYYY');
            return {
                m: m,
                value: ob.value,
                parsed: ob.value && m.isValid() ? m.format('DD.MM.YYYY') + (i > 0 ? ' 23:59:59' : '') : '\u00A0',
                valid: !ob.value || m.isValid()
            }
        });

        if (s.m && b.m && s.value && b.value && s.valid && b.valid && s.m > b.m) {
            s.valid = false;
            b.valid = false;
        }
        setSince(s);
        setBefore(b);
        props.onChange(s, b);
    }

    return e(BS.Form.Group, {},
        e(BS.Row, null,
            e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
                e(BS.Form.Control, {
                    placeholder: 'от (дд.мм.гггг)', name: 'since',
                    onChange: onChange,
                    isInvalid: !since.valid
                }),
                e(Trellos.Muted, {}, since.parsed)
            ),
            e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2, className: 'pl-0' },
                e(BS.Form.Control, {
                    placeholder: 'до (дд.мм.гггг)', name: 'before',
                    onChange: onChange,
                    isInvalid: !before.valid
                }),
                e(Trellos.Muted, {}, before.parsed)
            )
        )
    )
}


Trellos.Search = function (props) {
    const [searchProgress, setSearchProgress] = React.useState(false);

    const onSearch = (filter) => {
        if (searchProgress) return;
        console.log('Search. filter:', filter);
        setSearchProgress(true);

        /*
        loading boards
        search
        results
        */
    }

    return e('div', null,
        e(Trellos.Search.Form, { onSubmit: onSearch, inProgress: searchProgress })
    );
}

Trellos.Search.Form = function (props) {
    const [boards, setBoards] = React.useState(null);
    const [allBoards, setAllBoards] = React.useState(true);
    const [queryValid, setQueryValid] = React.useState(true);
    const [invalidMsg, setInvalidMsg] = React.useState('');
    const [formValid, setFormValid] = React.useState(false);

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

    const onSelectBoard = (event) => {
        const cb = event.target.closest('input[type="checkbox"]');
        if (!cb) return;
        if (cb.value == 'all') {
            setAllBoards(cb.checked);
        }
    }

    const validateQuery = (event) => {
        const val = event.target.value.trim();
        let valid = val.length == 0 ||
            (val.length > Trellos.preferences.minQueryLength &&
                Porter.stemText(val, Trellos.preferences.minTextLengthToStem).length > 0);
        setQueryValid(valid)
        validateForm();
    }

    const validateForm = () => {
        const query = get(document.getElementById('trellos-search-query'), 'value', '').trim();
        setFormValid(query.length > 1);
    }

    const onSubmit = (event) => {
        event.preventDefault();
        if (!formValid) return false;
        props.onSubmit({
            query: document.getElementById('trellos-search-query').value.trim(),
            allWords: document.getElementById('trellos-search-all-words').checked,
            allowArchive: document.getElementById('trellos-search-archive').checked,
            sortMode: document.getElementById('trellos-search-sort-alt').checked ? 'created' : 'modified',
            allBoards: document.getElementById('trellos-search-all-boards').checked,
            boards: Array.from(document.querySelectorAll('#trellos-search-form input[name="trellos-search-board"]:checked'))
                .map(x => x.value)
        })
    }

    return e(BS.Form, { onSubmit: onSubmit, id: 'trellos-search-form' },
        e(BS.Form.Group, null,
            e(BS.Form.Control, {
                type: 'text', placeholder: 'Что ищем?', size: 'lg', id: 'trellos-search-query',
                onChange: validateQuery, isInvalid: !queryValid
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Все слова',
                defaultChecked: true, id: 'trellos-search-all-words'
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Искать в архиве',
                id: 'trellos-search-archive'
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Сортировка по созданию',
                id: 'trellos-search-sort-alt'
            })
        ),
        e(BS.Form.Group, null,
            boards == null ? e(Trellos.Spinner) : e('div', null,
                e(BS.Form.Check, {
                    inline: true, style: { fontWeight: 'bold' }, defaultChecked: true,
                    id: 'trellos-search-all-boards', value: 'all', label: 'Все доски',
                    onClick: onSelectBoard
                }),
                allBoards ? null : boards.map(board => {
                    return e(BS.Form.Check, {
                        inline: true, type: 'checkbox', label: board.name, name: 'trellos-search-board',
                        id: `trellos-search-board-${board.id}`, value: board.id, key: board.id
                    })
                })
            )
        ),
        e(BS.Button, { disabled: !formValid || props.inProgress || !boards, type: 'submit', size: 'lg', className: 'mt-3' },
            props.inProgress ? e(Trellos.Spinner, { className: 'mr-2' }) : null,
            props.inProgress ? 'Поиск…' : 'Найти'
        )
    );
}

