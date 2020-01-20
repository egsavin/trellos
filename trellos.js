'use strict'

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

const trellos = function (element) {
    trellos.cache = new Cache({ storage: new ObjectStorage() });
    ReactDOM.render(e(Trellos), element);
}


trellos.nbsp = '\u00A0';


trellos.config = {
    meCacheTtl: 1000 * 60 * 5,
    minWordLengthToStem: 4,
    minQueryLength: 2,
    searchCacheTtl: 1000 * 60,
    searchPageSize: 30,
    cookieName: 'trellosjs2',
    cookieTtl: 60 * 60 * 24 * 365
}




trellos.plugins = [];
/* plugin is {
    name: string
    tab: name of React.Component
    body: name of React.Component
} */




trellos.getCookie = (name) => {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}


trellos.setCookie = (name, value, options = {}) => {
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
trellos.declOfNum = (number, one, two, five) => {
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = [one, two, five];
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}


trellos.unionArrays = (arr1, arr2) => {
    let arr3 = arr1.concat(arr2);
    let arr4 = arr3.filter((item, pos) => {
        return arr3.indexOf(item) == pos;
    })
    return arr4;
}


trellos.token = () => localStorage['trello_token'];


trellos.me = async (force = false) => {
    let me = trellos.cache.getItem('me');
    if (me && !force) return me;
    if (!trellos.token()) return null;
    try {
        me = await window.Trello.get('member/me', {
            fields: 'id,fullName,url,username,initials',
            boards: 'all'
        });
    } catch {
        delete localStorage['trello_token'];
        return null;
    }
    trellos.cache.setItem('me', me, trellos.config.meCacheTtl);
    return me;
}


trellos.checkFresh = (key) => {
    return Boolean(trellos.cache.getItem(key));
}


trellos.initialState = () => {
    const fieldKey = '_initialState';
    let state = trellos[fieldKey];
    if (state != undefined) return state;
    state = null;
    try {
        state = JSON.parse(decodeURIComponent(atob(
            trellos.getCookie(trellos.config.cookieName)
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
    trellos[fieldKey] = Object.assign({}, state);
    return trellos[fieldKey];
}



const Trellos = (props) => {
    const [me, setMe] = React.useState(null);
    const [hasLogout, setHasLogout] = React.useState(false);
    const [tab, setTab] = React.useState(null);
    const [state, setState] = React.useState(trellos.initialState());

    React.useEffect(() => {
        if (me && !trellos.checkFresh('me')) {
            if (trellos.token()) {
                trellos.me().then(newMe => {
                    if (newMe) setMe(newMe);
                    else if (!hasLogout) onAuth();
                })
            } else {
                onAuth();
            }
        }
        if (!me && !hasLogout) onAuth();
    })

    const onLoggedIn = (me) => {
        setHasLogout(!Boolean(me));
        setMe(me);
        if (me && !tab) {
            let newTab = state ? state.tab : null;
            if (!newTab && trellos.plugins.length) newTab = trellos.plugins[0].name;
            if (newTab) setTab(newTab);
        }
    }

    const onAuth = () => {
        if (me) return;
        window.Trello.authorize({
            type: 'popup',
            name: 'Trellos',
            scope: {
                read: 'true',
                write: 'true',
                account: 'true',
            },
            expiration: 'never',
            success: () => {
                trellos.me().then(onLoggedIn);
            },
            error: () => {
                setHasLogout(true);
                delete localStorage['trello_token'];
            }
        });
    }

    const onLogout = () => {
        setHasLogout(true);
        delete localStorage['trello_token'];
        window.Trello.deauthorize();
        setMe(null);
    }

    const onChangeTab = (key) => {
        setTab(key);
        onUpState('tab', key);
    }

    const onUpState = (name, data) => {
        let newState = Object.assign({}, state || {});
        newState[name] = data;
        setState(newState);
        saveState(newState);
    }

    const saveState = (data) => {
        if (state == null && data == null) return;
        let o = Object.assign({}, data || state);
        const s = JSON.stringify(o);
        trellos.setCookie(trellos.config.cookieName, btoa(encodeURIComponent(s)),
            { 'max-age': trellos.config.cookieTtl }
        );
    }

    return e(React.Fragment, null,
        me ? e(React.Fragment, null,
            e(Trellos.Nav, {
                me: me,
                tab: tab,
                onChangeTab: onChangeTab,
                onUpState: onUpState
            }),
            e(Trellos.Body, {
                me: me,
                tab: tab,
                onUpState: onUpState
            }),
            e(Trellos.Footer, { me: me, onUpState: onUpState, onLogout: onLogout })
        )
            : e(Trellos.Auth, { onAuth: onAuth }),
    )
}


Trellos.Auth = (props) => {
    return e('div', {},
        e(BS.Alert, { variant: 'danger' }, 'Требуется вход через Trello'),
        e(BS.Button, { onClick: props.onAuth }, 'Войти'),
        e('div', { className: 'mt-2' },
            e(Trellos.Muted, null, 'Разрешите всплывающие окна на странице')
        )
    )
}


Trellos.Nav = (props) => {
    const onSelect = function (key) {
        if (key != props.tab) props.onChangeTab(key);
    }

    return e(BS.Nav, { onSelect: onSelect, activeKey: props.tab, className: 'mb-4', variant: 'tabs' },
        trellos.plugins.map((plugin, index) =>
            e(React.Fragment, { key: `${plugin.name}-${index}` }, e(plugin.tab, props))
        )
    )
}


Trellos.Body = (props) => {
    let plugin = trellos.plugins.find(item => item.name == props.tab);
    if (plugin == null) return e(BS.Alert, { variant: 'warning' }, 'Плагины не найдены');
    if (!trellos.checkFresh('me')) return e(Trellos.Spinner);
    return e(plugin.body, props);
}


Trellos.Footer = (props) => {
    const [opened, setOpened] = React.useState(false);

    const onToggleSettings = (event) => {
        if (event) event.preventDefault();
        setOpened(!opened);
    }


    return e(React.Fragment, null,
        e('hr', { className: 'mt-5 mb-1' }),
        e(Trellos.FA, {
            as: 'a', var: 'cog', href: '#settings',
            onClick: onToggleSettings, className: 'text-secondary'
        }),
        e(BS.Modal, { show: opened, onHide: onToggleSettings, animation: false },
            e(BS.Modal.Body, null,
                e(Trellos.Profile, props)
            )
        )
    )
}


Trellos.Profile = (props) => {
    const onLogout = (event) => {
        if (event) event.preventDefault();
        props.onLogout();
    }

    return e('div', null,
        e(Trellos.FA, { var: 'user', className: 'mr-1 text-muted' }),
        e('a', { href: props.me.url, target: '_blank', className: 'mr-2' }, props.me.username),
        e('a', { href: '#logout', onClick: onLogout, className: 'btn-outline-danger btn btn-sm' }, 'Отключиться от Trello')
    )
}




Trellos.Muted = (props) => {
    let opts = Object.assign({}, props);
    opts.className = 'text-muted ' + props.className;
    delete opts['as'];
    return e(props.as || 'small', opts, props.children);
}


Trellos.FA = (props) => {
    let opts = Object.assign({}, props);
    delete opts.as;
    delete opts.children;
    delete opts.var;
    delete opts.type;
    let type = props.type || '';
    if (!type && props.var &&
        !props.var.startsWith('fas ') &&
        !props.var.startsWith('far ') &&
        !props.var.startsWith('fab ')) type = 'fas';
    if (!type && !props.var) type = 'fas';
    opts.className = type + ' ';
    opts.className += props.var && props.var.startsWith('fa-') ? '' : 'fa-';
    opts.className += props.var || 'star';
    opts.className += ' ' + (props.className || '');
    return e(props.as || 'i', opts, props.children)
}


Trellos.Spinner = function (props) {
    let opts = Object.assign({}, props);
    Object.assign(opts, { variant: 'dark', size: 'sm', animation: 'border' });
    return e(BS.Spinner, opts);
}