'use strict'
// Trellos.Search plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;


Trellos.Search = (props) => {
    const [searchProgress, setSearchProgress] = React.useState(false);
    const [searchResult, setSearchResult] = React.useState(null);

    const onSearch = () => {

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


Trellos.Search.validateQuery = (text) => {
    if (text == null || text == undefined) return false;
    text = text.trim();
    let valid = text.length >= trellos.config.minQueryLength;
    valid = valid && Porter.stemText(text, trellos.config.minWordLengthToStem).length > 0;
    return valid;
}




Trellos.Search.Form = function (props) {
    const [state, setState] = React.useState(trellos.g(trellos.initialState(), 'search', null));
    const [allBoards, setAllBoards] = React.useState(false);
    let [validQuery, setValidQuery] = React.useState(true);
    // let [validForm, setValidForm] = React.useState(false);
    // let [initState, setInitState] = React.useState(get(Trellos.getInitalState(), 'search', null));
    // let [period, setPeriod] = React.useState({
    //     since: get(initState, 'since', null),
    //     before: get(initState, 'before', null)
    // });

    const onSubmit = (event) => {
        if (event) event.preventDefault();
    }

    const validateQuery = (event) => {
        // const query = event.target.value;
        // const valid = Trellos.Search.validateQuery(query);
        // setValidQuery(valid);
        validateForm();
    }

    const validateForm = () => {
        let valid = false;

        let query = document.getElementById('trellos-search-query').value;
        let newValidQuery = Trellos.Search.validateQuery(query);
        setValidQuery(newValidQuery);
        valid = newValidQuery;

        // let isAllBoards = document.getElementById('trellos-search-all-boards').checked;
        // let hasCheckedBoards = document.querySelectorAll('#trellos-search-form input[name="trellos-search-board"]:checked').length > 0;
        // let ok = validQ && (isAllBoards || hasCheckedBoards);
        // setValidForm(ok);
        return valid;
    }

    const onSelectBoard = (event) => {
        const cb = event.target.closest('input[type="checkbox"]');
        if (!cb) return;
        if (cb.value == 'all') {
            setAllBoards(cb.checked);
        }
        validateForm();
    }

    return e(BS.Form, { onSubmit: onSubmit, id: 'trellos-search-form' },
        e(BS.Form.Group, null,
            e(BS.Form.Control, {
                type: 'text', placeholder: 'Поиск в Trello', size: 'lg', id: 'trellos-search-query',
                onChange: validateQuery, isInvalid: !validQuery,
                defaultValue: trellos.g(state, 'query', '')
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Все слова',
                defaultChecked: trellos.g(state, 'allWords', true), id: 'trellos-search-all-words'
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Искать в архиве',
                id: 'trellos-search-archive', defaultChecked: trellos.g(state, 'allowArchive', false)
            }),
            e(BS.Form.Check, {
                inline: true, type: 'checkbox', label: 'Сортировка по созданию',
                id: 'trellos-search-sort-alt', defaultChecked: trellos.g(state, 'sortMode', 'modified') == 'created'
            })
        ),
        e(BS.Form.Group, null,
            e(BS.Form.Check, {
                inline: true, className: 'font-weight-bold', 
                id: 'trellos-search-all-boards', value: 'all', label: 'Все доски',
                onChange: onSelectBoard, defaultChecked: trellos.g(state, 'allBoards', false)
            }),
            allBoards ? null : props.me.boards.map(board => {
                return e(BS.Form.Check, {
                    inline: true, type: 'checkbox', label: board.name, name: 'trellos-search-board',
                    id: `trellos-search-board-${board.id}`, value: board.id, key: board.id,
                    onChange: onSelectBoard,
                    defaultChecked: Boolean(trellos.g(state, 'boards', []).find(b => b == board.id))
                })
            })
        ),
        e(BS.Form.Group, { className: 'mb-0' }, 'Дата создания'),
        e(BS.Form.Group, null,
            e(Trellos.Form.DateInput, {name: 'since', placeholder: 'не ранее'})
        //     e(Trellos.Form.Period, {
        //         since: get(initState, 'since', null),
        //         before: get(initState, 'before', null),
        //         onChange: onChangePeriod
        //     })
        ),
        // e(BS.Form.Group, { className: 'my-4' },
        //     e(BS.Button, {
        //         disabled: !validForm || props.inProgress,
        //         type: 'submit', size: 'lg', className: 'px-4 mr-3',
        //         id: 'trellos-search-form-button'
        //     },
        //         props.inProgress ? e(Trellos.Spinner, { className: 'mr-2' }) : null,
        //         props.inProgress ? 'Поиск…' : 'Найти'
        //     )
        // )
    );
}