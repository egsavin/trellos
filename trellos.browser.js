'use strict'
// Trellos.Browser plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

Trellos.Browser = (props) => {
    const [idBoard, setIdBoard] = React.useState(null);
    const [members, setMembers] = React.useState([]);

    React.useEffect(() => {
        setMembers([]);
        if (!idBoard) return;
        let cachedMembers = trellos.cache.getItem(`browser-${idBoard}-members`);
        if (cachedMembers) {
            setMembers(cachedMembers);
            return;
        }

        const _idBoard = idBoard;
        window.Trello.get(`/boards/${idBoard}/members`, {
            fields: 'id,fullName,username'
        }).then((data) => {
            if (!data || !data.length) return;
            let newMembers = [...data];
            newMembers.idBoard = _idBoard;
            trellos.cache.setItem(`browser-${idBoard}-members`, newMembers, Trellos.Browser.config.browserCacheTtl);
            setMembers(newMembers);
        })
    }, [idBoard])

    const Card = (props) => e('div', {
        className: 'text-secondary ' + (props.className || '')
    },
        props.children
    )

    const Line = (props) => e('div', { key: trellos.rndstr(), className: props.className || null },
        props.children.map(ch => e('span', { key: trellos.rndstr(), className: 'mr-2 d-inline-block' }, ch))
    )

    const Small = (props) => e('small', { className: 'd-inline-block ' + (props.className || '') }, props.children)

    const CopyId = (props) => e(React.Fragment, { key: trellos.rndstr() },
        e('small', { className: 'mr-1 d-inline-block' }, props.children),
        e(Trellos.CopyToClipboard, { className: 'text-secondary small', value: props.children })
    )

    const BoardName = (props) => e('a', {
        href: `#`,
        onClick: (event) => {
            event.preventDefault();
            setIdBoard(props.id == idBoard ? null : props.id);
        }
    }, props.children)

    const BoardData = (props) => e(Card, { className: 'ml-3 ' + (idBoard == props.board.id ? "" : 'd-none') },
        e(Small, null, 'Списки:'), e('br'),
        props.board.lists.map(list => e(Line, { key: list.id },
            list.name, e(CopyId, null, list.id)
        )),
        e(Small, null, 'Участники:'), e('br'),
        !members.length || members.idBoard != idBoard ? e(Trellos.Spinner)
            : members.map(member => e(Line, { key: member.id },
                member.fullName,
                e(CopyId, null, member.id)
            ))
    )

    return e(React.Fragment, { key: trellos.rndstr() },
        e(Card, { className: 'mb-4' }, e(Line, null,
            e(Small, null, 'Me:'),
            props.me.fullName, props.me.username,
            e(CopyId, null, props.me.id),
        )),
        props.me.boards.sort(trellos.sortBoardComparer)
            .map(board => e(Card, { key: board.id, className: 'mb-2' },
                e(Line, null,
                    e(Small, null, 'Доска:'),
                    e(BoardName, { id: board.id }, board.name),
                    e(CopyId, null, board.id),
                ),
                e(BoardData, { board: board })
            ))
    )
}

Trellos.Browser.config = {
    browserCacheTtl: 1000 * 60 * 5,
}

Trellos.Browser.PluginFooter = (props) => e(Trellos.FA, {
    className: 'text-muted ',
    var: 'asterisk',
    style: { opacity: 0.4, cursor: 'pointer' }
})


Trellos.Browser.plugin = {
    name: 'browser',
    body: Trellos.Browser,
    footer: Trellos.Browser.PluginFooter,
    modal: 'Просмотр данных'
}