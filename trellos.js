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
    cookieName: 'trellosjs2',
    cookieTtl: 60 * 60 * 24 * 365
}




trellos.plugins = [];
/* plugin is {
    name: string
    tab: name of React.Component
    body: name of React.Component
} */

trellos.plugins.add = (plugin) => {
    const isPlugin = (p) => plugin && plugin.name && plugin.body && plugin.hasOwnProperty('tab');

    let ok = isPlugin(plugin);
    if (!ok && plugin && plugin.plugin) {
        plugin = plugin.plugin;
        ok = isPlugin(plugin)
    }
    if (!ok) return false;

    const already = trellos.plugins.find(p => p.name == plugin.name);
    if (already) return false;

    trellos.plugins.push(plugin);
    return true;
}




trellos.g = (props, name, def) => {
    if (props == null || props == undefined) return def;
    if (typeof (props) != 'object' && typeof (props) != 'function') return def;
    if (!props.hasOwnProperty(name)) return def;
    return props[name];
}


trellos.rndstr = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


trellos.replaceClass = (element, prev, next = null) => {
    if (!element) return;
    prev = (prev || '').trim();
    let classes = Array.from(element.classList).filter(c => c != prev);
    if (next) classes.push(next);
    element.className = classes.join(" ");
}


trellos.blinkClass = (element, prev, next, timeout = 1000) => {
    trellos.replaceClass(element, prev, next);
    return setTimeout(() => {
        trellos.replaceClass(element, next, prev);
    }, timeout);
}


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
    if (!trellos.token()) return null;
    let me = trellos.cache.getItem('me');
    if (me && !force) return me;
    try {
        me = await window.Trello.get('member/me', {
            fields: 'id,fullName,url,username,initials',
            boards: 'all',
            board_fields: 'id,name,closed,starred,shortUrl',
            board_lists: 'all'
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


trellos.validatePeriod = (since, before, options = {}) => {
    since = since || null;
    before = before || null;
    const sinceMoment = moment(since);
    const beforeMoment = moment(before);
    options = {
        allowEmptySince: true,
        allowEmptyBefore: true,
        allowEqual: true,
        ...options
    };
    let validSince = true;
    let validBefore = true;

    // проверка на пустоту
    if (!options.allowEmptySince && !since) validSince = false;
    if (!options.allowEmptyBefore && !before) validBefore = false;

    // проверка непустых на валидность
    if (validSince && since) validSince = sinceMoment.isValid();
    if (validBefore && before) validBefore = beforeMoment.isValid();

    // проверка непустых на то, что начало периода не больше окончания
    if (validSince && validBefore && since && before) {
        validSince = options.allowEqual ? sinceMoment <= beforeMoment : sinceMoment < beforeMoment;
        validBefore = validSince;
    }

    return [validSince, validBefore];
}


trellos.getRecursive = async (path, parameters = {}, chunkCallback = null) => {
    let allData = []; // контейнер для результатов
    let chunkIndex = 0;

    // функция загрузки
    const recursiveLoad = async (before) => {
        // Трелло возвращает не больше 1000 объектов
        let prms = {
            ...parameters,
            before: before, // 'before' используем для смещения в "прошлое"
            limit: 1000 // max лимит трелло
        }
        const data = await window.Trello.get(path, prms); // получаю чанк
        if (data.length > 0) { // если есть результаты
            allData = allData.concat(data);
            // все объекты Трелло имеют поле id. Нахожу минимальный
            let minId = data.map(x => x.id).reduce((p, n) => n < p ? n : p);
            if (minId) {
                if (chunkCallback) chunkCallback(chunkIndex, data, allData.length);
                chunkIndex++;
                // загружая следующий чанк. Передаю minId, он будет использован как условие before
                await recursiveLoad(minId);
            }
        } else {
            // если результаты пустые, то конец рекурсии
        }
    }
    // ---------------

    await recursiveLoad(parameters.before || ""); // запуск
    return allData;
}


trellos.convertTrelloIdToMoment = function (trelloId) {
    return moment(1000 * parseInt(trelloId.substring(0, 8), 16));
    // https://help.trello.com/article/759-getting-the-time-a-card-or-board-was-created
}




const Trellos = (props) => {
    const [me, setMe] = React.useState(null);
    const [hasLogout, setHasLogout] = React.useState(false);
    const [tab, setTab] = React.useState(null);
    const [state, setState] = React.useState(trellos.initialState());
    const [first, setFirst] = React.useState(true);

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
                onUpState: onUpState,
                first: first
            }),
            e(Trellos.Footer, { me: me, onUpState: onUpState, onLogout: onLogout })
        )
            : e(Trellos.Auth, { onAuth: onAuth }),
    )
}


Trellos.Auth = (props) => {
    const showAuthControls = () => {
        const alrt = document.getElementById('trellos-auth-alert');
        const ctrl = document.getElementById('trellos-auth-controls');
        if (alrt) {
            alrt.innerText = 'Требуется вход через трелло';
            trellos.replaceClass(alrt, 'alert-info', 'alert-danger');
        }
        if (ctrl) trellos.replaceClass(ctrl, 'd-none', 'd-block');
    }

    React.useEffect(() => {
        setTimeout(showAuthControls, 1000);
    }, [])

    return e('div', {},
        e(BS.Alert, { variant: 'info', id: 'trellos-auth-alert' }, 'Вход через Trello...'),
        e('div', { id: 'trellos-auth-controls', className: 'd-none' },
            e(BS.Button, { onClick: props.onAuth, id: 'trello-auth-button' }, 'Войти'),
            e('div', { className: 'mt-2' },
                e(Trellos.Muted, null, 'Разрешите всплывающие окна на странице')
            ))
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

    const styles = {
        modalHeader: {
            borderBottom: 0
        }
    }

    return e(React.Fragment, null,
        e('hr', { className: 'mt-5 mb-1' }),
        e(Trellos.FA, {
            as: 'a', var: 'cog', href: '#settings',
            onClick: onToggleSettings, className: 'text-secondary'
        }),
        e(BS.Modal, { show: opened, onHide: onToggleSettings, animation: false },
            e(BS.Modal.Header, { closeButton: true, style: styles.modalHeader },
                e(Trellos.Profile, props)
            ),
            e(BS.Modal.Body, { className: 'p-1' },
                // e(Trellos.Profile, props)
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
        e(Trellos.FA, { var: 'user', className: 'mr-1 text-muted align-middle' }),
        e('a', { href: props.me.url, target: '_blank', className: 'mr-2 align-middle' }, props.me.username),
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
    let opts = {
        ...props,
        as: null,
        children: null,
        var: null,
        type: null
    }
    let type = props.type || '';
    if (!type && props.var &&
        !props.var.startsWith('fas ') &&
        !props.var.startsWith('far ') &&
        !props.var.startsWith('fab ')) type = 'fas';
    if (!type && !props.var) type = 'fas';
    opts.className = type + ' ';
    if (props.var && props.var.startsWith('fas ') ||
        props.var.startsWith('far ') ||
        props.var.startsWith('fab ')) {
        opts.className += props.var;
    } else {
        opts.className += props.var && props.var.startsWith('fa-') ? '' : 'fa-';
        opts.className += props.var || 'star';
    }
    opts.className += ' ' + (props.className || '');
    return e(props.as || 'i', opts, props.children)
}


Trellos.IconLink = (props) => {
    let aopts = {
        ...props,
        className: 'icon-link ' + (props.className || ''),
        var: null,
        type: null,
        as: null,
        children: null
    }
    delete aopts.children;
    let iopts = {
        ...props,
        className: 'mr-1',
        onClick: null,
        href: null,
        target: null,
        children: null
    }

    return e('a', aopts,
        e(Trellos.FA, iopts),
        props.children
    )
}


Trellos.Spinner = function (props) {
    let opts = Object.assign({}, props);
    Object.assign(opts, { variant: 'dark', size: 'sm', animation: 'border' });
    return e(BS.Spinner, opts);
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

    let opts = {
        ...props,
        className: 'd-inline-block px-2 ' + (props.className || ''),
        style: {
            ...trellos.g(styles, props.variant, styles.none),
            borderRadius: "10px",
            fontSize: '0.6rem',
        },
        children: null,
        variant: null
    }
    return e('span', opts, props.children);
}


Trellos.CopyToClipboard = (props) => {
    const [inputId, setInputId] = React.useState('cpytxtinp-' + (props.id || trellos.rndstr()));

    const styles = {
        input: {
            padding: 0,
            width: '1px',
            fontSize: '1px',
            display: 'inline',
            border: 'none',
            color: 'transparent',
            backgroundColor: 'transparent'
        }
    }

    const onClick = (event) => {
        if (event) event.preventDefault();
        const inp = document.getElementById(inputId);
        inp.focus();
        inp.select();
        document.execCommand("copy");
        inp.blur();
        if (props.onClick) props.onClick(event, inp.value);
    }

    const aOpts = {
        className: props.className || '',
        id: props.id || null,
        href: props.href || '#',
        onClick: onClick
    }

    return e(React.Fragment, { key: props.key || props.id || props.name || trellos.rndstr },
        e('input', {
            id: inputId,
            style: styles.input,
            value: props.value || props.href,
            onChange: (event) => { event.preventDefault(); }
        }),
        props.children ?
            e('a', aOpts, props.children) :
            e(Trellos.IconLink, {
                ...aOpts,
                type: props.type || 'far',
                var: props.var || 'copy',
            }, props.text || null),
    )
}




Trellos.Form = (props) => null;


Trellos.Form.DateControl = (props) => {
    const [value, setValue] = React.useState(null);
    const [isEmpty, setIsEmpty] = React.useState(true);

    React.useEffect(() => { // init
        if (props.defaultValue) updateValue(props.defaultValue);
    }, [])

    const updateValue = (text) => {
        text = text.trim();
        const parseFormat = trellos.g(props, 'parseFormat', 'DD.MM.YYYY');
        const mdate = moment(text, parseFormat);
        setIsEmpty(text.length == 0);
        setValue(mdate);
        return mdate;
    }

    const onChange = (text) => {
        const mdate = updateValue(text)
        if (props.onChange) props.onChange(text, mdate);
    }

    const parsedValue = () => {
        if (!value || !value.isValid()) return trellos.nbsp;
        const showFormat = trellos.g(props, 'showFormat', 'DD.MM.YYYY');
        return value.format(showFormat);
    }

    const isValid = () => {
        const autoInvalid = trellos.g(props, 'autoInvalid', true);
        if (!autoInvalid) return (props.isValid !== undefined && props.isValid !== null) ? Boolean(props.isValid) : null;
        if (autoInvalid && isInvalid()) return null;
        if (!isEmpty && value != null && value.isValid()) return true;
        return null;
    }

    const isInvalid = () => {
        let invalid = (props.isInvalid !== undefined && props.isInvalid !== null) ? Boolean(props.isInvalid) : null;
        if (invalid !== null) return invalid;
        if (!trellos.g(props, 'autoInvalid', true)) return invalid;
        if (trellos.g(props, 'emptyIsValid', true) && isEmpty) return false;
        return value == null || !value.isValid();
    }

    const defaultName = 'trellos-date-' + trellos.rndstr();
    let opts = {
        ...props,
        name: props.name || defaultName,
        onChange: (event) => onChange(event.target.value),
        isValid: isValid(),
        isInvalid: isInvalid(),
        id: props.id || defaultName
    }

    return e(React.Fragment, { key: `input-${props.name || defaultName}` },
        e(BS.Form.Control, opts),
        trellos.g(props, 'showParsed', true) ? e(Trellos.Muted, {}, parsedValue()) : null
    )
}