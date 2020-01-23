'use strict'
// Trellos.Export plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

Trellos.Export = (props) => {
    const [board, setBoard] = React.useState(null);

    const onSelectBoard = (key) => {
        setBoard(props.me.boards.find(b => b.id == key));
    }

    return e(React.Fragment, { key: 'trellos-export' },
        board ? null : e(Trellos.Export.Boards, { ...props, onSelect: onSelectBoard }),
        !board ? null : e(Trellos.Export.Board, { ...props, board: board, onBack: () => setBoard(null) })
        // Boolean(board) ? e('div', null,
        //     
        //     exportData ? null : ,
        //     exportData ? e(Trellos.Export.Download, { board: board, data: exportData }) : null
        // ) : null
    );
}


Trellos.Export.PluginTab = (props) => {
    return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'export' },
        e('i', { className: 'fas fa-file-download d-inline-block d-sm-none mx-2' }),
        e('span', { className: 'd-none d-sm-inline-block' }, 'Экспорт')
    ))
}


Trellos.Export.plugin = {
    name: 'export',
    tab: Trellos.Export.PluginTab,
    body: Trellos.Export
}




Trellos.Export.Boards = (props) => {
    return e(BS.Nav, { activeKey: props.idBoard, className: 'flex-column', onSelect: props.onSelect },
        props.me.boards
            .sort(trellos.sortBoardComparer)
            .map(board => {
                return e(BS.Nav.Item, { key: board.id },
                    e(BS.Nav.Link, {
                        eventKey: board.id,
                        className: (board.closed ? 'text-secondary' : null) + ' pl-0 pt-0'
                    }, board.name)
                )
            })
    )
}


Trellos.Export.Board = (props) => {
    const [inProgress, setInProgress] = React.useState(false);
    const [exportData, setExportData] = React.useState(null);

    const onExport = (filter) => {
        if (inProgress) return;
        setInProgress(true);

        Trellos.Export.doExport(filter).then(data => {
            setExportData(data);
            setInProgress(false);
        })
    }

    const view = () => {
        if (inProgress) return 'inProgress';
        if (exportData) return 'download';
        return 'form';
    }

    return e(React.Fragment, { key: 'trellos-export-board' },
        e(Trellos.Back, {
            onClick: props.onBack,
            className: 'mb-3',
            disable: inProgress
        },
            props.board.name,
            e('a', { href: props.board.shortUrl, target: "_blank", className: 'ml-3  text-secondary' },
                e('small', { className: 'fab fa-trello' })
            )
        ),
        view() == "form" ? e(Trellos.Export.Form, { ...props, onSubmit: onExport }) : null,
        view() == "inProgress" ? e(Trellos.Spinner, null, 'Загрузка…') : null,
        view() == 'download' ? e(Trellos.Export.Download, { ...props, data: exportData }) : null,
    )
}


Trellos.Export.doExport = async (filter) => {
    const dateFilter = (mdate, addDays) => {
        if (!mdate) return '';
        if (addDays) mdate.add(addDays, 'day');
        console.log('datef', mdate.format('YYYY-MM-DD'));
        return mdate.format('YYYY-MM-DD');
    }

    const data = await trellos.getRecursive(`boards/${filter.board.id}/cards`, {
        filter: filter.onlyVisible ? "visible" : "all",
        fields: "id,name,idBoard,idList,labels,closed,shortLink,shortUrl,dateLastActivity",
        members: "true",
        members_fields: "id,fullName,username",
        since: dateFilter(filter.since),
        before: dateFilter(filter.before, 1)
    })

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
    data.map(card => {
        if (filter.lists.length && !filter.lists.find(idList => idList == card.idList)) return;
        const list = filter.board.lists.find(l => l.id == card.idList);
        const created = trellos.convertTrelloIdToMoment(card.id)
        csv.push([
            card.shortLink,
            card.name,
            filter.board.name,
            trellos.g(list, 'name', ''),
            card.members.map(m => m.fullName).join(','),
            card.labels.map(l => l.name || l.color).join(","),
            card.closed ? 'closed' : '',
            trellos.g(list, 'closed', '') ? 'closed' : '',
            filter.board.closed ? 'closed' : '',
            card.shortUrl,
            moment(card.dateLastActivity).format('DD.MM.YYYY HH:MM'),
            created.format("DD.MM.YYYY"),
            created.format("DD.MM.YYYY HH:mm"),
            card.id,
            trellos.g(list, 'id', ''),
            filter.board.id
        ]);
    })
    return csv;
}


Trellos.Export.Form = function (props) {
    const [onlyVisible, setOnlyVisible] = React.useState(true);
    const [period, setPeriod] = React.useState({ since: null, before: null });
    const [lists, setLists] = React.useState([]);

    const onSubmit = (event) => {
        if (event) event.preventDefault();
        props.onSubmit({
            board: props.board,
            onlyVisible,
            lists,
            since: period.since,
            before: period.before
        })
    }

    const onChangePeriod = (name, text, mdate) => {
        if (name != 'since' && name != 'before') return;
        text = text.trim();
        let newPeriod = { ...period };
        newPeriod[name] = text.length ? mdate : null;
        setPeriod(newPeriod);
    }

    const isInvalidPeriod = (name) => {
        if (name != 'since' && name != 'before') return null;
        if (period[name] === null) return null;
        const [validSince, validBefore] = trellos.validatePeriod(period.since, period.before);
        return !(name == 'since' ? validSince : validBefore);
    }

    const onChangeLists = (newLists) => {
        setLists(newLists);
    }

    return e(BS.Form, { onSubmit: onSubmit },
        e(BS.FormGroup, null,
            e(BS.Form.Check, {
                inline: true, id: "visible-cards", label: "Видимые списки/карточки",
                type: 'radio', name: 'visibility', defaultChecked: true,
                onClick: () => { setOnlyVisible(true) }
            }),
            e(BS.Form.Check, {
                inline: true, id: "all-cards", label: "Все карточки",
                type: 'radio', name: 'visibility',
                onClick: () => { setOnlyVisible(false) }
            })
        ),
        e(Trellos.Export.Form.Lists, { board: props.board, onlyVisible: onlyVisible, onChange: onChangeLists }),
        e(BS.Form.Group, { className: 'mb-0' }, 'Дата создания'),
        e(BS.Form.Group, null,
            e(BS.Row, null,
                e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
                    e(Trellos.Form.DateControl, {
                        placeholder: 'от (дд.мм.гггг)',
                        name: 'since',
                        onChange: (text, mdate) => onChangePeriod('since', text, mdate),
                        isInvalid: isInvalidPeriod('since'),
                        id: 'trellos-export-since'
                    })
                ),
                e(BS.Col, { xs: 6, sm: 5, md: 3, lg: 2 },
                    e(Trellos.Form.DateControl, {
                        placeholder: 'по (дд.мм.гггг)',
                        name: 'before',
                        onChange: (text, mdate) => onChangePeriod('before', text, mdate),
                        isInvalid: isInvalidPeriod('before'),
                        id: 'trellos-export-before'
                    })
                ),
            )
        ),
        e(BS.Button, { type: 'submit' }, "Скачать карточки")
    )
}


Trellos.Export.Form.Lists = function (props) {
    const [lists, setLists] = React.useState([]);

    const onClick = (event) => {
        const cb = event.target.closest('input');
        if (!cb) return;

        let newLists = lists.filter(l => l != cb.value);
        if (cb.checked) newLists.push(cb.value);
        setLists(newLists);
        props.onChange(newLists);
    }

    return e(BS.Form.Group, null,
        props.board.lists
            .sort(trellos.sortListComparer)
            .map((list) => {
                if (props.onlyVisible && list.closed) return null;
                return e(BS.Form.Check, {
                    key: list.id,
                    label: list.name,
                    type: 'checkbox',
                    id: list.id,
                    className: (list.closed ? 'text-secondary' : null) + ' mb-1',
                    name: 'trellos-export-list',
                    onClick: onClick,
                    value: list.id,
                })
            }),
        e(Trellos.Muted, null, 'Если списки не выбраны, то выгружается всё')
    )
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
        trellos.downloadAsFile(fileName(), text);
    }

    const styles = {
        downloadIcon: { fontSize: '1.6rem' },
        typeIcon: { fontSize: '1.3rem', verticalAlign: 'middle' },
    }

    const fileName = () => `export-${props.board.name.toLowerCase()}.csv`;

    return e('div', { style: { lineHeight: '3rem' } },
        e('div', { className: 'mb-2' },
            e('i', {
                className: 'fas fa-file-download mr-2 text-muted',
                style: styles.downloadIcon
            }),
            props.data.length <= 1 ? 'Нет карточек' :
                `${props.data.length - 1} ` + trellos.declOfNum(props.data.length - 1, 'карточка', 'карточки', 'карточек')
        ),
        props.data.length > 1 ? e(React.Fragment, null,
            e(BS.Button, {
                variant: "outline-primary",
                className: 'mr-2',
                onClick: onDownload,
                id: "trellos-export-semicolon"
            },
                e('i', {
                    className: 'far fa-file-excel mr-1',
                    style: styles.typeIcon
                }), fileName()),
            e(BS.Button, {
                variant: "outline-primary",
                id: "trellos-export-comma",
                onClick: onDownload
            },
                e('i', {
                    className: 'far fa-file-alt mr-1',
                    style: styles.typeIcon
                }), fileName()),
        ) : null
    )
}