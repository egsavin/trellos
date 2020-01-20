'use strict'
// Trellos.Export plugin

window['e'] = React.createElement;
window['BS'] = ReactBootstrap;

Trellos.Export = (props) => {
    return e('div', null, 'EXPORT');
}

Trellos.Export.PluginTab = (props) => {
    return e(BS.NavItem, {}, e(BS.Nav.Link, { eventKey: 'export' },
        e('i', { className: 'fas fa-file-download d-inline-block d-sm-none mx-2' }),
        e('span', { className: 'd-none d-sm-inline-block' }, 'Экспорт')
    ))
}

// register plugin
trellos.plugins.push({
    name: 'export',
    tab: Trellos.Export.PluginTab,
    body: Trellos.Export
});