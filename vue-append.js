;
(function () {
  var vueAppend = {}

  var fireEvent = function (element, event) {
    if (document.createEventObject) {
      // for ie
      var evt = document.createEventObject();
      return element.fireEvent('on' + event, evt)
    } else {
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent(event, true, true);
      // Dispatches an Event at the specified EventTarget, 返回值：是否
      return !element.dispatchEvent(evt);
    }
  };


  var slice = [].slice,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    table = document.createElement('table'),
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table,
      'thead': table,
      'tfoot': table,
      'td': tableRow,
      'th': tableRow,
      '*': document.createElement('div')
    };

  // 传入字符串的html，返回dom节点
  var fragment = function (html, name, properties) {
    var dom, container
    // A special case optimization for a single tag (只有元素标签，没有内容的前提)
    if (singleTagRE.test(html)) dom = document.createElement(RegExp.$1)

    if (!dom) {
      // 如果设置了替换的话，会对html中错误编写的标签，例如<div />，进行替换成<div></div>
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      // RegExp.$1: RegExp这个对象会在我们调用了正则表达式的方法后, 自动将最近一次的结果保存在里面
      // 所以目的就是：判断是否'<','>'包裹, 且标签不为空
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      if (!(name in containers)) name = '*'
      
      // 采用div+innerHTML
      container = containers[name]
      container.innerHTML = '' + html
      // 为什么要调用removeChild来得到返回的dom节点呢？
      // 可能的原因：
      // 保证container不用占据太多内存，同时尽快被垃圾回收？，如果直接使用container.childNodes + cloneNodes呢？
      dom = slice.call(container.childNodes).map(function (child) {
        return container.removeChild(child)
      })
    }

    return dom
  }
  // 遍历node tree
  function traverseNode(node, fun) {
    fun(node)
    for (var key in node.childNodes) {
      traverseNode(node.childNodes[key], fun)
    }
  }
  // nodes由fragment(val)返回，targer代表当前指令元素，cb代表append结束后的回调
  var append = function (nodes, target, cb) {
    var pendingIndex = 0;
    var doneIndex = 0;
    nodes.forEach(function (_node) {
      // 对节点进行深复制
      var node = _node.cloneNode(true)
      if (document.documentElement !== target && document.documentElement.contains(target)) {
        traverseNode(target.insertBefore(node, null), function (el) {
          // 如果html中包含script
          if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' && (!el.type || el.type === 'text/javascript')) {
            pendingIndex++;
            if (el.src) {
              var http = new XMLHttpRequest();
              http.open('GET', el.src, true);
              http.onreadystatechange = function () {
                if (http.readyState === 4) {
                  // Makes sure the document is ready to parse.
                  if (http.status === 200) {
                    el.innerHTML = http.responseText;
                    var target = el.ownerDocument ?
                      el.ownerDocument.defaultView :
                      window;
                    target['eval'].call(target, el.innerHTML);
                    doneIndex++;
                    if (doneIndex === pendingIndex) {
                      cb();
                    }
                  }
                }
              };
              http.send(null);
            } else {
              // ownerDocument: 返回document对象
              // defaultView: 该属性返回当前 document 对象所关联的 window 对象，如果没有，会返回 null。
              var target = el.ownerDocument ? el.ownerDocument.defaultView : window
              target['eval'].call(target, el.innerHTML);
              doneIndex++;
              if (doneIndex === pendingIndex) {
                cb();
              }
            }
          }
        })
      }
    })
  }

  var exec = function (el, val) {
    if (val) {
      try {
        el.innerHTML = '';
        append(fragment(val), el, function cb() {
          fireEvent(el, 'appended');
        })
      } catch (e) {
        fireEvent(el, 'appenderr');
        console.error(e);
      }
    }
  }

  // exposed global options
  vueAppend.config = {};

  vueAppend.install = function (Vue) {
    Vue.directive('append', {
      // 指令钩子函数: 传参el:指令绑定的元素，data:binding对象（指令名，指令的绑定值等）
      inserted: function (el, data) {
        // v-append="html", data.value就是html
        exec(el, data.value);
      },
      componentUpdated: function (el, data) {
        if (data.value !== data.oldValue) {
          exec(el, data.value);
        }
      }
    })
  }

  if (typeof exports == "object") {
    module.exports = vueAppend;
  } else if (typeof define == "function" && define.amd) {
    define([], function () {
      return vueAppend
    });
  } else if (window.Vue) {
    window.VueAppend = vueAppend;
    Vue.use(vueAppend);
  }

})();
