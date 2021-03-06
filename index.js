var $ROOT_DIR = require('path').dirname(require.main.filename)
var $REQ = ""
var fs = require('fs')
var path = require('path')
var numeral = require('numeral');
// global on the server, window in the browser
var root = this;
var mime = require("mime");

/*
* think.js v1.0 (http://code.google.com/p/thinkweb)m
* 
* Code license
* (Apache License 2.0)
*/
var $t = {};

// extensions
(function () {
    String.prototype.format = function () {
        var args = [];
        if (arguments.length == 1) args = arguments[0];
        else if (arguments.length > 1) {
            for (var i = 0; i < arguments.length; i++)
                args.push(arguments[i]);
        }
        if (!(args instanceof Array)) args = [args];
        var bits = this.split(/%s/g);
        var ret = [];
        for (var i = 0; i < bits.length - 1; i++) {
            ret.push(bits[i]);
            if (i < args.length) ret.push(args[i]);
        }
        ret.push(bits[i]);
        return ret.join('');
    };
    String.prototype.toJSON = function () {
        return JSON.parse(this);
    }
    Array.prototype.forEachX = function (func, ctx) {
        var ret = [];
        for (var i = 0; i < this.length; i++)
            ret.push(func.call(ctx, this[i], i));
        return ret;
    };
    Array.prototype.withEach = function (func, arg) {
        for (var i = 0; i < this.length; i++)
            arg = func(this[i], arg);
        return arg;
    };
    dump = function (obj) {
        if (typeof obj == "object" || obj instanceof Array)
            return JSON.stringify(obj);
        return obj;
    };
})();

// utility functions
(function () {
    this.createXmlHttp = function () {
        if (window.XMLHttpRequest) return new XMLHttpRequest();
        else return new ActiveXObject("Microsoft.XMLHTTP");
    };
    this.ajax = function (args) {
        args = $t.extend({
            'callback': function () { },
            'type': 'GET',
            'url': '',
            'isAsync': true,
            'data': null
        }, args);
        var req = this.createXmlHttp();
        req.onreadystatechange = function () {
            if (req.readyState == 4)
                args['callback'].call(req);
        };
        req.open(args['type'], args['url'], args['isAsync']);
        req.send(args['data']);
    };
    this.jsonp = function (args) {
        args = $t.extend({
            'callback': 'cb',
            'url': ''
        }, args);
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("language", "javascript");
        script.src = args['url'].toString().format(args['callback']);
        document.getElementsByTagName('head')[0].appendChild(script);
    };
    this.as_args_kwargs_with = function (tokens) {
        var as_var = undefined;
        var with_var = undefined;
        var args = [];
        var kwargs = {};
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (token == "as") {
                as_var = tokens[++i];
                continue;
            }
            if (token == "with") {
                with_var = tokens[++i];
                continue;
            }
            if (token.indexOf('=') != -1) {
                var s = token.split('=', 1);
                kwargs[s[0]] = s[1];
            }
            else
                args.push(token);
        }
        return [args, kwargs, as_var, with_var];
    };
    this.as_kwargs = function (tokens) {
        var kwargs = {};
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (token == "as") {
                kwargs['as'] = tokens[++i];
                continue;
            }
            if (token == "with") {
                kwargs['with'] = tokens[++i];
                continue;
            }
            if (token.indexOf('=') != -1) {
                var s = token.split('=', 1);
                kwargs[s[0]] = s[1];
            }
            else
                kwargs[i + ""] = token;
        }
        return kwargs;
    };
    this.extend = function (target, source) {
        if (!source) return target;
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
        return target;
    }
}).call($t);

// parser
(function () {
    this.Parser = function (content) {
        this.stream = content.replace(/(\r)/gm, "");
        this.tokensplitter = /\s+/gm;
        this.tokens = content.split(this.tokensplitter);
        this.curridx = -1;
        this.hasParsed = false;
    };
    this.Parser.prototype.parse = function (pattern) {
        if (this.hasParsed) return undefined;
        var match = this.stream.search(pattern);
        if (match == -1) {
            this.hasParsed = true;
            return [this.stream];
        }
        var parsedvalue = this.stream.substring(0, match);
        var value = this.stream.match(pattern)[0];
        this.stream = this.stream.substring(match + value.length);
        match = null;
        return [parsedvalue, value];
    };
    this.Parser.prototype.parseNext = function () {
        return this.parse(/\s+/gm);
    };
}).call($t);

// templatemyweb skeleton
(function () {
    this.template = {

        libraries: {},

        TemplateParser: function (content) {
            this.parser = new $t.Parser(content);
        },

        Template: function (template, callback, params) {
            var obj = this;

            var loadTemplate = function (contentType) {
                var templateParser = new $t.template.TemplateParser(template);
                var tokens = undefined;
                this.nodelist = [];
                while ((tokens = templateParser.parseNext())) {
                    this.nodelist.push($t.template.libraries["__static__"](templateParser, { "template": tokens[0] }));
                    if (tokens.length > 1) {
                        var bits = tokens[1].split(/\s+/g);
                        var hint = bits[1].split('.').length > 1 ? "." + bits[1].split('.')[1] : "";

                        this.nodelist.push($t.template.libraries["__" + bits[1].split('.')[0] + "__"](templateParser, $t.as_kwargs(bits.slice(2, bits.length - 1)), hint));
                    }
                }
                if (callback) callback(this, contentType);
            }

            if (callback) {
                var root = params && params.rootFolder ? params.rootFolder : "";
                var filePath = path.join($ROOT_DIR, root, template);

                fs.readFile(filePath, "utf8", function (err, data) {

                    var contentType = mime.lookup(filePath);

                    template = data.toString();

                    // ?
                    if (template.charCodeAt(0) === 65279)
                        template = template.substring(1);

                    loadTemplate.call(obj, contentType);
                })

                /*fs.exists(filePath, function (exists) {
                    if (exists) {
                        fs.readFile(filePath, function (err, data) {
                            if (err) console.log(err);
                            else {
                                template = data.toString();
                                loadTemplate.call(obj);
                            }
                        });
                    }
                    else {
                        loadTemplate.call(obj);
                    }
                });*/
            }
            else {
                loadTemplate.call(obj);
                return this;
            }
        },

        template: function (template, callback, params) {
            new $t.template.Template(template, callback, params);
        },

        // render
        render: function (template, context, callback, params) {
            new $t.template.Template(template, function (t, contentType) {
                callback(t.render(context));
            }, params);
        },

        // render
        renderToHttpResponse: function (template, context, req, res, callback, params) {
            $REQ = req;
            new $t.template.Template(template, function (t, contentType) {

                if (!res.headerSent && contentType) {
                    res.setHeader("Content-Type", contentType);
                }

                t.render(context, res);
                $REQ = "";
                callback();
            }, params);
        },

        // unrender
        unrender: function (template, filledTemplate, callback) {
            new $t.template.Template(template, function (t) {
                callback(t.unrender(filledTemplate));
            });
        }
    };

    this.template.TemplateParser.prototype.parseNext = function () {
        return this.parser.parse(/{%(.)*?%}/gm);
    };

    this.template.TemplateParser.prototype.parse = function (tag, matchFromEnd) {
        return this.parser.parse(new RegExp(matchFromEnd ? "{%(\\s)*" + tag + "(\\s)*?%}(?!.*{%(\\s)*" + tag + "(\\s)*?%})" : "{%(\\s)*" + tag + "(\\s)*?%}", "m"));
    };

    this.template.Template.prototype.render = function (context, writer) {
        var out = "";
        try {
            for (var i = 0; i < this.nodelist.length; i++) {
                var resp = this.nodelist[i].render(context);
                if (writer)
                    writer.write(resp);
                else
                    out += resp;
            }
        } catch (e) {
            console.log(' error with think, e: %s', e);
            console.error(' error with think, e: %s', e);
        }
        return out;
    };

    this.template.Template.prototype.unrender = function (template, out) {
        out = out ? out : {};
        for (var i = 0; i < this.nodelist.length; i++) {
            this.nodelist[i].unrender(template, out);
        }
        return out;
    };
}).call($t);

// register static
(function () {

    this.__static__ = function (parser, kwargs) {
        return new this.static(kwargs);
    };
    this.static = function (params) {
        params = $t.extend({ 'template': '' }, params);
        this.nodelist = params['template'];

        var re = /{{(.)*?}}/gm, nodes = [], lidx = 0;
        while (m = re.exec(this.nodelist)) {
            var val = this.nodelist.substring(lidx, m.index);
            if (val) {
                nodes.push({
                    expr: val,
                    type: "text"
                });
            }
            var it = m[0];
            var key = it.substring(2, it.length - 2);
            var subre = new RegExp(/__(.)*?__/gm);
            var tokenMatch = subre.exec(key);
            if (tokenMatch == null) {
                nodes.push({
                    expr: "context." + key,
                    type: "expr1",
                    orig: key
                });
            }
            else {
                var subnodes = [], slidx = 0
                do {
                    var subval = key.substring(slidx, tokenMatch.index);
                    if (subval) {
                        subnodes.push({
                            expr: subval,
                            type: "text"
                        });
                    }
                    var subit = tokenMatch[0];
                    var subkey = subit.substring(2, subit.length - 2);
                    subnodes.push({
                        expr: "context." + subkey,
                        type: "expr1",
                        orig: subkey
                    });

                    slidx = tokenMatch.index + subit.length;
                    subval = null;
                }
                while (tokenMatch = subre.exec(key));
                subnodes.push({
                    expr: key.substring(slidx, key.length),
                    type: "text"
                });

                nodes.push({
                    expr: subnodes,
                    type: "expr2",
                    orig: key
                });
            }
            lidx = m.index + it.length;
            val = null;
        }
        nodes.push({
            expr: this.nodelist.substring(lidx, this.nodelist.length),
            type: "text"
        });

        this.nodes = nodes;
        nodes = null;
    };
    this.static.prototype.render = function (context, writer) {

        var render = function (node, context) {
            var val = undefined;
            switch (node.type) {
                case "text":
                    return node.expr;
                case "expr1":
                    try {
                        if (typeof context == "string") val = context;
                        else val = eval(node.expr);
                    } catch (e) { }
                    if (!val) val = "";
                    if (typeof val != "undefined")
                        val = dump(val);
                    return val;
            }
        }

        var ret = [];
        for (var i = 0; i < this.nodes.length; i++) {
            switch (this.nodes[i].type) {
                case "text":
                case "expr1":
                    var val = render(this.nodes[i], context);
                    if (writer)
                        writer.write(val);
                    else
                        ret.push(val);
                    break;
                    val = null;
                case "expr2":
                    //console.log("evaluating expr2 : %j", this.nodes[i])
                    var subvals = [];
                    for (var j = 0; j < this.nodes[i].expr.length; j++) {
                        subvals.push(render(this.nodes[i].expr[j], context));
                    }
                    if (writer)
                        writer.write(eval(subvals.join("")));
                    else
                        ret.push(eval(subvals.join("")));
                    subvals = null;
                    break;
            }
        }

        return ret.join("");
    };
    this.static.prototype.unrender = function (template, out) {
        var match = this.nodelist.replace(/[\s\(\)]+/g, " ").match(/{{(.)*?}}/gm);
        if (!match) return this.nodelist;

        template = template.replace(/[\s\(\)]+/g, " ");
        var o = [];
        var s = "";
        s = match.withEach(function (it, str) {
            var key = it.substring(2, it.length - 2);
            o.push(key);
            return str.replace(it, "(.*)");
        }, this.nodelist);

        var r = new RegExp(s, "img").exec(template);
        if (!r || r == null) return;
        r.splice(0, 1);
        for (var i = 0; i < r.length; i++) {
            out[o[i]] = r[i];
        }
    };
}).call($t.template.libraries);

// register repeat
(function () {

    this.__repeat__ = function (parser, kwargs, parseHint) {
        kwargs["template"] = parser.parse("endrepeat" + parseHint)[0];
        return new this.repeat(kwargs);
    };

    this.repeat = function (params) {
        params = $t.extend({ 'template': '' }, params);
        this.data = params['0'];
        this.filter = params['1'];
        this.nodelist = new $t.template.Template(params['template']);
    };
    this.repeat.prototype.pred = function (iter) {
        var s = -1, e = 9999999;

        var pred = function (s, e) {
            return function (idx) {
                return idx >= s && idx <= e;
            };
        };

        if (this.filter) {

            var f = this.filter.split("..");

            if (f.length == 2) {
                s = parseInt(f[0]);
                var ss = f[1].split("-");
                if (ss.length == 1)
                    e = (f[1] == "n" ? iter.length - 1 : parseInt(f[1]));
                else {
                    e = iter.length - 1 - parseInt(ss[1]);
                    this.filter = s + ".." + e;
                }
                return pred(s, e);
            }
            f = this.filter.split("+");
            if (f.length == 2) {
                s = parseInt(f[0]); e = s + parseInt(f[1]);
                return pred(s, e);
            }
            f = this.filter.split("-");
            if (f.length == 2) {
                e = f[0] == "n" ? iter.length - 1 : parseInt(f[0]); s = e - parseInt(f[1]);
                return pred(s, e);
            }
            else if (f.length == 1) {
                s = parseInt(f[0]); e = s;
                e = f[0] == "n" ? iter.length - 1 : e;
                s = f[0] == "n" ? e : s;
                return pred(s, e);
            }
        }
    };
    this.repeat.prototype.render = function (context, writer) {
        var iter = context instanceof Array ? context : undefined;
        if (!iter) try { iter = eval("context." + this.data); } catch (e) { }
        if (!iter || iter == null) return "";//return "<!--{% repeat " + this.data + " %}-->" + this.nodelist.render({}) + "<!--{% endrepeat %}-->";
        var pred = this.pred(iter);
        if (pred)
            return iter.forEachX(function (it, idx) {
                it["idx"] = idx;
                if (!pred(idx)) return "";
                return this.nodelist.render(it, writer);
            }, this).join('');
        else
            return iter.forEachX(function (it, idx) {
                it["idx"] = idx;
                return this.nodelist.render(it, writer);
            }, this).join('');
    };
    this.repeat.prototype.unrender = function (template, out) {
        out[this.data] = [];
    };
}).call($t.template.libraries);

// register if
(function () {

    this.__if__ = function (parser, kwargs) {
        kwargs["template"] = parser.parse("endif")[0];
        return new this.if(kwargs);
    };

    this.if = function (params) {
        params = $t.extend({ 'template': '' }, params);
        this.data = params['0'];
        this.nodelist = new $t.template.Template(params['template']);
    };
    this.if.prototype.render = function (context, writer) {
        var cond = false;
        try {
            var data = eval("context['" + this.data + "']");
            cond = data ? true : false;
        } catch (e) { }
        if (cond)
            return this.nodelist.render(context, writer);
        else
            return "";
    };
    this.if.prototype.unrender = function (template, out) {
        out[this.data] = [];
    };
}).call($t.template.libraries);

// register skip
(function () {

    this.__skip__ = function (parser, kwargs, parseHint) {
        kwargs["template"] = parser.parse("endskip" + parseHint)[0];
        return new this.skip(kwargs);
    };

    this.skip = function (params) {
        params = $t.extend({ 'template': '' }, params);
        this.nodelist = params['template'];
    };
    this.skip.prototype.render = function (context, writer) {
        return this.nodelist;
    };
    this.skip.prototype.unrender = function (template, out) {
        out[this.data] = [];
    };
}).call($t.template.libraries);

// register box
(function () {

    this.__box__ = function (parser, kwargs) {
        kwargs["template"] = parser.parse("endbox", true)[0];
        return new this.box(kwargs);
    };

    this.box = function (params) {
        params = $t.extend({
            'url': '',
            'autoupdate': false,
            'onupdate': 'append',
            'mode': 'query',
            'template': ''
        }, params);
        this.name = params.name;
        this.url = params['url'];
        this.autoupdate = params['autoupdate'] ? true : false;
        this.onupdate = params['onupdate'];
        this.nodelist = new $t.template.Template(params['template']);
        this.mode = params['mode'];

        if (this.autoupdate) {
            clearInterval($t.template.libraries.box.updatetimers[this.name]);
            $t.template.libraries.box.updatetimers[this.name] = setInterval("$t.template.libraries.box.updatebox('" + this.name + "')", 10000);
        }
    };
    this.box.prototype.update = function () {
        $t.jsonp({
            'url': this.url,
            'callback': '$t.template.libraries.box.onboxupdated'
        });
    };
    this.box.prototype.handleupdate = function (context) {
        var res = this.render(context);

        if (this.onupdate == "append")
            document.getElementById("__%s.box__".format(this.name)).innerHTML += this.render(context);
        else
            document.getElementById("__%s.box__".format(this.name)).innerHTML = this.render(context);
    };
    this.box.prototype.render = function (context, writer) {
        if (this.mode == 'query')
            return this.nodelist.render(context, writer);
        else
            return context;
    };
}).call($t.template.libraries);

// box utils
(function () {
    this.list = {};
    this.updatetimers = {};

    this.updatebox = function (name) {
        this.list[name].update();
    };
    this.onboxupdated = function (obj) {
        var name = obj.name;
        var res = obj.result;
        this.list[name].handleupdate(res);
    };
    this.add = function (params) {
        this.list[params.name] = new this(params);
    };
}).call($t.template.libraries.box);

// test
// var parser = new $t.Parser("{% runquery name=post as stocks %}");
//alert(parser.parseNext());
//alert(parser.parseNext());
//alert(parser.parse("stocks"));

//document.write(new $t.template.Template("<ul> {% repeat result %} <li>Count: {{cnt}} </li> {% endrepeat %}</ul>").render({ "result": [{'cnt': 1}, {'cnt': 2}, {'cnt': 3}] }));

module.exports = $t.template;
