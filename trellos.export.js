'use strict'

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

// Trellos.Export plugin

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
                const created = Trellos.convertTrelloIdToTime(card.id)
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

if (!Trellos.Plugins) Trellos.Plugins = {};
Trellos.Plugins['export'] = {
    plugin: (props) => { return e(Trellos.Export, props) },
    tab: (props) => {
        return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'export' },
            e('i', { className: 'fas fa-file-download d-inline-block d-sm-none mx-2' }),
            e('span', { className: 'd-none d-sm-inline-block' }, 'Экспорт')
        ))
    }
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
            }).join(btn.id == 'trellos-export-semicolon' ? ';' : ',');
        }).join("\n");
        text = '\ufeff' + text; // UTF-8 BOM
        Trellos.utils.downloadAsFile(`export-${props.board.name.toLowerCase()}.csv`, text);
    }

    return e('div', { style: { lineHeight: '3rem' } },
        e('div', { className: 'mb-2' },
            e('i', { className: 'fas fa-file-download mr-2 text-muted', style: { fontSize: '1.6rem' } }),
            (`${props.data.length - 1} ` + Trellos.utils.declOfNum(props.data.length - 1, ['карточка', 'карточки', 'карточек']))
        ),
        e(BS.Button, { variant: "outline-primary", className: 'mr-2', onClick: onDownload, id: "trellos-export-semicolon" },
            e('i', { className: 'far fa-file-excel mr-1', style: { fontSize: '1.3rem', verticalAlign: 'middle' } }), `export-${props.board.name.toLowerCase()}.csv`),
        e(BS.Button, { variant: "outline-primary", id: "trellos-export-comma", onClick: onDownload },
            e('i', { className: 'far fa-file-alt mr-1', style: { fontSize: '1.3rem', verticalAlign: 'middle' } }), `export-${props.board.name.toLowerCase()}.csv`),
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
            view == 'progress' ? e(Trellos.Spinner, { className: 'mr-2' }) : null, 'Экспорт в CSV'
        )
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
    const [since, setSince] = React.useState({ value: '', parsed: Trellos.nbsp, valid: true });
    const [before, setBefore] = React.useState({ value: '', parsed: Trellos.nbsp, valid: true });
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
                parsed: ob.value && m.isValid() ? m.format('DD.MM.YYYY') + (i > 0 ? ' 23:59:59' : '') : Trellos.nbsp,
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
