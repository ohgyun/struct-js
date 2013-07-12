/**
 * Struct for using array buffer
 * @param {Array} defs Struct definitions
 * @param [ArrayBuffer] buffer a array buffer object. create buffer if not passed.
 * @param [Boolean] isLittleEndian default value is false
 * @example
    var s = new Struct([
        'uint16 packetId',
        'uint32 statusCode',
        'cstring method[11]',
        'uint8 bodyType',
        'uint32 bodyLength'
    ]);

    s.set('packetId', 1);
    s.set('statusCode', 2);
    s.set('method', 'buy');
    s.set('bodyType', 1);
    s.set('bodyLength', 43);


    console.log(s.get('packetId'));
    console.log(s.get('statusCode'));
    console.log(s.get('method'));
    console.log(s.get('bodyType'));
    console.log(s.get('bodyLength'));
 */
(function (Struct) {

    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Struct;
        });

    } else if (typeof module !== 'undefined') {
        module.exports = Struct;

    } else {
        window.Struct = Struct;
    }

}(function () {

    var Struct = function (defs, buffer, isLittleEndian) {
        this._defMap = {};

        var totalBytes = this._parseDefs(defs);

        this._buffer = buffer || new ArrayBuffer(totalBytes);
        this._dataView = new DataView(this._buffer);

        this.LITTE_ENDIAN = isLittleEndian;
    };

    var rDef = /^(uint8|uint16|uint32|cstring) (\w+)(?:\[(\d+)\])?$/;
    var sproto = Struct.prototype;

    sproto._parseDefs = function (defs) {
        var totalBytes = 0,
            self = this;

        defs.forEach(function (def) {
            if (rDef.test(def)) {

                var type = RegExp.$1;
                var name = RegExp.$2;
                var byteSize = Struct._typeMap[type].byteSize;
                var offset = totalBytes;
                var length = parseInt(RegExp.$3, 10) || 1;

                totalBytes += (length * byteSize);

                self._defMap[name] = {
                    type: type,
                    offset: offset,
                    length: length
                };

            } else {
                throw new Error('Invalid Struct Definition: ' + def.toString());
            }
        });

        return totalBytes;
    };

    sproto.getLength = function () {
        return this._buffer.byteLength;
    };

    sproto.set = function (name, value) {
        var def = this._getDefByName(name);
        var setter = Struct._typeMap[def.type].setter;
        setter.call(this, value, def.offset, def.length);
    };

    sproto.get = function (name) {
        var def = this._getDefByName(name);
        var getter = Struct._typeMap[def.type].getter;
        return getter.call(this, def.offset, def.length);
    };

    sproto._getDefByName = function (name) {
        var def = this._defMap[name];
        if (! def) {
            throw new Error(name + 'does not defined');
        }
        return def;
    };

    sproto.toString = function (type) {
        type = type || 'hex';
        return Struct._toStringMap[type].call(this);
    };

    sproto.eachByte = function (callback) {
        var i = 0,
            v,
            len = this.getLength();

        for (; i < len; i++) {
            v = this._dataView.getUint8(i);
            callback.call(this, v, i);
        }
    };

    sproto._padZero = function (str, count) {
        var len = count - str.length;
        while (len--) {
            str = '0' + str;
        }
        return str;
    };

    sproto.toNodeBuffer = function () {
        var nbuf = new Buffer();
        this.eachByte(function (v, i) {
            nbuf[i] = v;
        });
        return nbuf;
    };

    Struct._typeMap = {
        'uint8': {
            byteSize: 1,
            setter: function (value, offset) {
                this._dataView.setUint8(offset, value);
            },
            getter: function (offset) {
                return this._dataView.getUint8(offset);
            }
        },
        'uint16': {
            byteSize: 2,
            setter: function (value, offset) {
                this._dataView.setUint16(offset, value, this.LITTE_ENDIAN);
            },
            getter: function (offset) {
                return this._dataView.getUint16(offset, this.LITTE_ENDIAN);
            }
        },
        'uint32': {
            byteSize: 4,
            setter: function (value, offset) {
                this._dataView.setUint32(offset, value, this.LITTE_ENDIAN);
            },
            getter: function (offset) {
                return this._dataView.getUint32(offset, this.LITTE_ENDIAN);
            }
        },
        'cstring': {
            byteSize: 1,
            setter: function (value, offset, length) {
                var len = Math.min(value.length, length - 1);
                for (var i = 0; i < len; i++) {
                    this._dataView.setUint8(offset++, value.charCodeAt(i));
                }
                // 종료 문자를 추가한다.
                this._dataView.setUint8(offset, 0);
            },
            getter: function (offset, length) {
                var i = 0, c, str = '';
                for (; i < length; i++) {
                    c = this._dataView.getUint8(offset++);
                    if (c === 0) { break; }
                    str += String.fromCharCode(c);
                }
                return str;
            }
        }
    };

    Struct._toStringMap = {
        'hex': function () {
            var hex, str = '';
            this.eachByte(function (v) {
                hex = this._padZero(v.toString(16), 2);
                str += hex;
            });
            return str;
        },
        'binary': function () {
            var str = '';
            this.eachByte(function (v) {
                str += this._padZero(v.toString(2), 8);
            });
            return str;
        }
    };


    return Struct;

}()));