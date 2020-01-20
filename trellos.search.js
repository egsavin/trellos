'use strict'
// Trellos.Search plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

Trellos.Search = (props) => {
    return e('div', null, 'SEARCH');
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