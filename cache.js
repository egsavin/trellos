'use strict'



class Cache {
    constructor(opts) {
        this.defaultTtl = Cache.p(opts, 'defaultTtl', 1000 * 60 * 5); // ms
        this.gc = Cache.p(opts, 'gc', true); // enable garbage collector
        this.gcInterval = Cache.p(opts, 'gcInterval', 1000 * 60 * 10);  // ms (interfal of garbage collection)
        this.storage = Cache.p(opts, 'storage', window.sessionStorage);
        if (this.defaultTtl < 0) this.defaultTtl = 0;
        let gc = _cache_gc.bind(this);
        if (this.gcInterval > 0) this._gcInterval = setInterval(gc, this.gcInterval);
    }

    static p(props, name, def) {
        if (props == null) return def;
        if (typeof (props) != 'object') return def;
        if (!props.hasOwnProperty(name)) return def;
        return props[name];
    }

    setItem(key, value, ttl) {
        let k = this._key(key);
        if (k) {
            this.storage.removeItem(k.key + ":::" + k.expire);
        }
        let t = ttl >= 0 ? ttl : this.defaultTtl;
        this.storage.setItem(this._newKey(key, t), value);
    }

    getItem(key) {
        let k = this._key(key);
        if (!k) return null;
        if (k.expire > 0 && k.expire <= Date.now()) {
            this.storage.removeItem(k.key);
            return null;
        }
        return this.storage.getItem(k.key + ":::" + k.expire);
    }


    removeItem(key) {
        let k = this._key(key);
        if (!k) return false;
        this.storage.removeItem(k.key + ":::" + k.expire);
        return k.expire == 0 || Date.now() < k.expire;
    }

    keys() {
        let now = Date.now();
        let keys = this._keys;
        let res = [];
        for (let i = 0; i < keys.length; i++) {
            if (now > keys[i].expire) res.push(keys[i].key);
        }
        return keys;
    }

    _newKey(key, ttl) {
        let exp = ttl > 0 ? Date.now() + ttl : 0;
        return String(key) + ":::" + exp;
    }

    _keys() {
        let keys = [];
        for (let i = 0; i < this.storage.length; i++) {
            let sub = String(this.storage.key(i)).split(':::');
            if (sub.length != 2 || !sub[0].length || !sub[1].length) continue;
            let exp = -1;
            if (sub[1] == "0") {
                exp = 0;
            } else {
                exp = Number.parseInt(sub[1]);
                if (!(exp > 0)) continue;
            }
            keys.push({
                key: sub[0],
                expire: exp
            });
        }
        return keys;
    }

    _key(key) {
        let keys = this._keys();
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].key == key) return keys[i];
        }
        return null;
    }
}


function _cache_gc(cache) {
    cache = cache || this;
    if (this == window) {
        // console.log('Unbinded call of _cache_gc');
        return;
    }
    let now = Date.now();
    cache._keys().forEach((key) => {
        if (key.expire <= now) {
            cache.storage.removeItem(key.key + ":::" + key.expire);
        }
    })
    // console.log('cache GC');
}


class ObjectStorage /* extends Storage */ {
    constructor() {
        this._store = []; // [values]
        this._keys = []; // [ {keyName: str, storeIndex: int}]
    }

    get length() {
        return this._store.length;
    }

    // returns key name by keyIndex
    key(keyIndex) {
        let i = parseInt(keyIndex);
        if (i >= this._keys.length) return null;
        return this._keys[i].key;
    }

    getItem(key) {
        let item = this._item(key);
        if (item == null) return null;
        return this._store[item.storeIndex];
    }

    setItem(key, value) {
        let item = this._item(key);
        if (item == null) {
            item = {
                key: key,
                storeIndex: this._store.length
            }
            this._keys.push(item);
        }
        this._store[item.storeIndex] = value;
    }

    removeItem(key) {
        let item = this._item(key);
        if (item == null) return;
        this._store.splice(item.storeIndex, 1);
        this._keys.splice(item.keyIndex, 1);
    }

    clear() {
        this._store = [];
        this._keys = [];
    }

    _item(keyName) {
        for (let i = 0; i < this._keys.length; i++) {
            let item = this._keys[i];
            item.keyIndex = i;
            if (item.key == keyName) return item;
        }
        return null;
    }
}