'use strict'
// Trellos.Dash plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

// 572b01c243d0fe5584854b37
// 5b9627c70be47e5fac74bdde,573415388737a62d5689534c,5cadc11977e0103aad553d75,5860043ef044bae11fed73e9
// 572b01ce2c4e62bca8cc7d5f,5a2572b868dd56b82f309e65
// 572b01d0ffe9abe7e0c08acd
// 5b0ffbcc738bd83d75de2b12,572b01d7fff66e209bffd3bb

// 58134fba843845c32ee4aa67 al

Trellos.Dash = (props) => {
    const [settings, setSettings] = React.useState(Trellos.Dash.initialSettings())
    const [onSettings, setOnSettings] = React.useState(false)

    const view = () => {
        if (onSettings) return "settings";
        if (!Trellos.Dash.validateSettings(settings)) return 'badSettings';
        return 'dash';
    }

    const onSaveSettings = (newSettings) => {
        setSettings({ ...newSettings });
        setOnSettings(false);
        props.onUpState('dash', newSettings);
    }

    const dashLink = () => e('a', {
        style: { opacity: 0.6 },
        target: "_blank",
        href: `${document.location.origin + document.location.pathname}?tab=dash&dash=` + btoa(encodeURIComponent(JSON.stringify(settings)))
    }, 'Ссылка на панель')

    React.useEffect(() => {
        if (settings.idBoard) Trellos.Dash.data(settings, true);
    }, [settings.idBoard])

    return e(React.Fragment, { key: 'trellos-dash' },
        view() == 'dash' ? e(Trellos.Dash.Dash, { ...props, settings }) : null,
        e('div', { className: 'small mt-5' },
            view() == 'badSettings' ? e('span', { className: 'align-middle text-danger mr-2' }, 'Панель не настроена!') : null,
            e('a', {
                className: 'mr-5',
                href: '#',
                onClick: (event) => { event.preventDefault(); setOnSettings(true) },
            }, 'Настройка панели'),
            view() == 'badSettings' ? null : dashLink()
        ),
        view() == "settings" ? e(Trellos.Dash.Settings, {
            ...props,
            onSave: onSaveSettings,
            onCancel: () => setOnSettings(false),
            settings
        }) : null,
    );
}


Trellos.Dash.config = {
    dataCacheTtl: 1000 * 60 * 1
}


Trellos.Dash.PluginTab = (props) => {
    return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'dash' },
        e('i', { className: 'fas fa-file-download d-inline-block d-sm-none mx-2' }),
        e('span', { className: 'd-none d-sm-inline-block' }, 'Панель')
    ))
}


Trellos.Dash.plugin = {
    name: 'dash',
    tab: Trellos.Dash.PluginTab,
    body: Trellos.Dash,
}




Trellos.Dash.initialSettings = () => {
    const initial = trellos.g(trellos.initialState(), 'dash', null);
    return {
        idBoard: trellos.g(initial, 'idBoard', null),
        idMembers: trellos.g(initial, 'idMembers', []),
        idListsTodo: trellos.g(initial, 'idListsTodo', []),
        idListsWork: trellos.g(initial, 'idListsWork', []),
        idListsDone: trellos.g(initial, 'idListsDone', []),
    }
}


Trellos.Dash.validateSettings = (settings) => {
    return settings.idBoard &&
        settings.idMembers && settings.idMembers.length && (
            (settings.idListsTodo && settings.idListsTodo.length) ||
            (settings.idListsWork && settings.idListsWork.length) ||
            (settings.idListsDone && settings.idListsDone.length)
        )
}




Trellos.Dash.Settings = (props) => {
    const [idBoard, setIdBoard] = React.useState(trellos.g(props.settings, 'idBoard', null));
    const [idMembers, setIdMembers] = React.useState(trellos.g(props.settings, 'idMembers', []));
    const [idListsTodo, setIdListsTodo] = React.useState(trellos.g(props.settings, 'idListsTodo', []));
    const [idListsWork, setIdListsWork] = React.useState(trellos.g(props.settings, 'idListsWork', []));
    const [idListsDone, setIdListsDone] = React.useState(trellos.g(props.settings, 'idListsDone', []));

    const onSave = () => {
        props.onSave({
            idBoard,
            idMembers,
            idListsTodo,
            idListsWork,
            idListsDone
        });
    }

    const selectedBoard = () => props.me.boards.find(b => b.id == idBoard);

    const splitValue = (text) => {
        if (!text || !text.trim().length) return [];
        return String(text).split(/[\s,.]/)
            .map(v => v.trim())
            .filter(v => v.length)
    }

    return e(Trellos.ModalForm, {
        title: 'Параметры панели',
        onSave: onSave,
        onCancel: props.onCancel,
    },
        e(BS.FormGroup, null,
            e(BS.Form.Control, {
                placeholder: 'Доска Trello',
                defaultValue: idBoard || '',
                onChange: (event) => setIdBoard(event.target.value.trim() || null)
            }),
        ),
        e(BS.FormGroup, null,
            e(BS.Form.Control, {
                disabled: !selectedBoard(),
                placeholder: 'Участники',
                defaultValue: idMembers.length ? idMembers.join(",") : '',
                onChange: (event) => setIdMembers(splitValue(event.target.value))
            }),
        ),
        e(BS.FormGroup, null,
            e(BS.Form.Control, {
                disabled: !selectedBoard(),
                placeholder: 'Списки «Очередь»',
                defaultValue: idListsTodo.length ? idListsTodo.join(",") : '',
                onChange: (event) => setIdListsTodo(splitValue(event.target.value))
            }),
        ),
        e(BS.FormGroup, null,
            e(BS.Form.Control, {
                disabled: !selectedBoard(),
                placeholder: 'Списки «Работа»',
                defaultValue: idListsWork.length ? idListsWork.join(",") : '',
                onChange: (event) => setIdListsWork(splitValue(event.target.value))
            }),
        ),
        e(BS.FormGroup, null,
            e(BS.Form.Control, {
                disabled: !selectedBoard(),
                placeholder: 'Списки «Готово»',
                defaultValue: idListsDone.length ? idListsDone.join(",") : '',
                onChange: (event) => setIdListsDone(splitValue(event.target.value))
            }),
        ),
    )
}


Trellos.Dash.Dash = (props) => {
    const [data, setData] = React.useState(null);

    React.useEffect(() => {
        if (trellos.checkFresh('dashboard') && data) return;
        setData(null);
        Trellos.Dash.data(props.settings).then((newData) => {
            setData(newData);
        })
    })

    const link = (href, text) => e(BS.Card.Title, null,
        e('a', {
            href: href,
            target: '_blank',
            className: 'text-secondary'
        }, text)
    )

    const cardsCount = (count, name, color) => {
        let text = 'Нет задач ' + name;
        if (count > 0) text = count + ' ' + trellos.declOfNum(count, 'задача', "задачи", "задач") + ' ' + name;
        return e('div', {
            className: (count > 0 ? color : 'text-danger') + ' mt-3 px-2'
        }, text)
    }

    const cardUrl = (card, member) => card.shortUrl + "?filter=member:" + member.username;

    const stage = (member, listField, name, color, hideZero = false) => {
        const lists = data.lists.filter(list => props.settings[listField].find(idl => idl == list.id));
        const cards = data.cards.filter(card =>
            card.members.find(mbr => mbr.id == member.id) &&
            props.settings[listField].find(idl => idl == card.idList)
        );
        if (hideZero && !cards.length) return null;
        return e(React.Fragment, { key: trellos.rndstr() },
            cardsCount(cards.length, name, color),
            e(BS.ListGroup, {
                variant: 'flush'
            },
                cards.map(card => e(BS.ListGroup.Item, {
                    key: card.id,
                    as: 'div',
                    className: 'small p-2 m-0'
                },
                    e('a', {
                        className: 'mr-2 text-secondary',
                        target: "_blank",
                        href: cardUrl(card, member),
                        title: `${data.board.name} / ` + lists.find(l => l.id == card.idList).name
                    }, card.name),
                    e(Trellos.CopyToClipboard, {
                        className: 'mr-2 text-primary', type: 'fas', var: 'link',
                        value: card.shortUrl, style: { opacity: 0.6 }
                    }),
                    e(Trellos.CopyToClipboard, { value: card.name, className: 'text-muted', style: { opacity: 0.8 } }),
                ))
            ))
    }

    return !data ? e(Trellos.Spinner) :
        e(BS.CardDeck, null,
            props.settings.idMembers.map(idMember => {
                const member = data.members.find(mbr => mbr.id == idMember);

                return e(BS.Card, {
                    key: idMember,
                    style: { flexBasis: '300px', maxWidth: '600px' },
                    className: 'mb-4'
                },
                    e(BS.Card.Body, { className: 'px-0 pt-3 pb-2' },
                        e('div', { className: 'px-2' },
                            link(`${data.board.shortUrl}?filter=member:${member.username}`, member.fullName)
                        ),
                        e(BS.Card.Text, { as: 'div' },
                            stage(member, 'idListsTodo', 'в очереди', 'text-info'),
                            stage(member, 'idListsWork', 'в работе', 'text-warning'),
                            stage(member, 'idListsDone', 'на проверку', 'text-success', true),
                        )
                    )
                )
            })
        );
}


Trellos.Dash.data = async (settings, force = false) => {
    let data = trellos.cache.getItem('dashboard');
    if (data && !force) return data;
    data = {}
    const me = await trellos.me();
    data.board = me.boards.find(board => board.id == settings.idBoard);
    data.members = trellos.cache.getItem(`dashboard-members-${settings.idBoard}`);
    if (!data.members || force) {
        const members = await window.Trello.get(`/boards/${settings.idBoard}/members`, {
            fields: 'id,username,fullName'
        });
        data.members = members.filter(m => settings.idMembers.find(idm => idm == m.id));
        trellos.cache.setItem(`dashboard-members-${settings.idBoard}`, data.members, Trellos.Dash.config.dataCacheTtl);
    }
    data.lists = data.board.lists
        .filter(list => {
            return settings.idListsTodo.find(idl => idl == list.id)
                || settings.idListsWork.find(idl => idl == list.id)
                || settings.idListsDone.find(idl => idl == list.id)
        });
    const cards = await trellos.boardCards(settings.idBoard, force);
    data.cards = cards.filter(card => {
        return !card.closed &&
            card.members.find(crdMbr => settings.idMembers.find(idm => idm == crdMbr.id)) &&
            (settings.idListsTodo.find(idl => idl == card.idList)
                || settings.idListsWork.find(idl => idl == card.idList)
                || settings.idListsDone.find(idl => idl == card.idList))
    });
    trellos.cache.setItem('dashboard', data, Trellos.Dash.config.dataCacheTtl);
    return data;
}