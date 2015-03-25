var request = require('request');
var Promise = require('es6-promise').Promise;
var sha1 = require('sha1');
var md5 = require('MD5');
var rndm = require('rndm');

var wx = module.exports = {

  urlencodify: function(obj) {
    return Object.keys(obj).sort().map(function (key) {
      return key + '=' + obj[key];
    }).join('&');
  },

  xmlify: function(obj) {
    var content = Object.keys(obj).map(function(key) {
      return '<' + key + '>' + obj[key] + '</' + key + '>';
    }).join('');
    return '<xml>' + content + '</xml>';
  },

  xmlToObj: function(xml) {
    var contents = xml.split('\n');
    contents = contents.slice(1, contents.length - 1);

    return contents.reduce(function(sofar, line) {
      line.replace(/\<(.+)\>\<\!\[CDATA\[(.+)\]\]\>/, function(matched, key, value) {
        sofar[wx.camelize(key)] = value;
      });
      return sofar;
    }, {});
  },

  nonceStr: function() {
    return rndm(10);
  },

  camelize: function(str) {
    return str.toLowerCase().replace(/\_(\w)/g, function(matched, ch) {
      return ch.toUpperCase();
    });
  },

  sha1Signature : function(target) {
    if (typeof target === 'object') {
      return sha1(wx.urlencodify(target));
    } else if (typeof target === 'string'){
      return sha1(target);
    }
  },

  md5Signature: function(target) {
    if (typeof target === 'object') {
      return md5(wx.urlencodify(target));
    } else if (typeof target === 'string'){
      return md5(target);
    }
  },

  getAccessToken: function(appId, appsecret) {
    var requestUrl = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + appId + "&secret=" + appsecret;
    return promisify(request.get)(requestUrl, { json: true }).then(wx._parseResponse);
  },

  getUserInfo: function(accessToken, openId) {
    var url = 'https://api.weixin.qq.com/cgi-bin/user/info?access_token=' + accessToken + '&openid=' + openId + '&lang=zh_CN';
    return promisify(request.get)(url, { json: true }).then(wx._parseResponse);
  },

  createMenu: function(accessToken, buttons) {
    var url = 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token=' + accessToken;
    return promisify(request.post)(url, { body: JSON.stringify(buttons) }).then(wx._parseResponse);
  },

  JS: {
    getJsApiTicket: function(accessToken) {
      var url = "https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=" + accessToken + "&type=jsapi";
      return promisify(request.get)(url, { json: true }).then(wx._parseResponse);
    },

    appInfo: function(appId, appsecret, jsapiTicket, currentUrl) {
      var timestamp = Date.now();
      timestamp = parseInt(timestamp.toString().substring(0, timestamp.toString().length - 3));
      var nonceStr = wx.nonceStr();
      var signature = wx.sha1Signature({ "noncestr": nonceStr, "timestamp": timestamp, "jsapi_ticket": jsapiTicket, "url": currentUrl });
      return { appId: appId, /* appsecret: appsecret,*/ timestamp: timestamp, nonceStr: nonceStr, signature: signature };
    }
  },

  OAuth2: {
    authorizeUrl: function(appId, scope, state, redirectUrl) {
      return 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + appId + '&redirect_uri=' + redirectUrl + '&response_type=code&scope=' + scope + '&state=' + state + '#wechat_redirect';
    },
    getAccessToken: function(appId, appSecret, code) {
      var url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + appId + '&secret=' + appSecret + '&code=' + code + '&grant_type=authorization_code';
      return promisify(request.get)(url, { json: true }).then(wx._parseResponse)
    },
    getUserInfo: function(accessToken, openId) {
      var url = 'https://api.weixin.qq.com/sns/userinfo?access_token=' + accessToken + '&openid=' + openId + '&lang=zh_CN';
      return promisify(request.get)(url, { json: true }).then(wx._parseResponse);
    }
  },

  Payment: {
    unifiedOrder: function(merchantId, merchantSecret, appId, outTradeNo, outProductBody, totalFee, originIP, tradeType, notifyUrl, extras) {
      var url = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
      var data = {
        appid              : appId,
        mch_id             : merchantId,
        nonce_str          : wx.nonceStr(),
        body               : outProductBody,
        out_trade_no       : outTradeNo,
        total_fee          : totalFee,
        spbill_create_ip   : originIP,
        trade_type         : tradeType,
        notify_url         : notifyUrl
      };

      if (extras) { data = extend(data, extras); }

      var baseStr = wx.urlencodify(data);
      data.sign = md5(baseStr + '&key=' + merchantSecret).toUpperCase();

      return promisify(request.post)(url, { body: wx.xmlify(data) }).then(function(returns) {
        return wx.xmlToObj(returns[1]);
      });
    },

    paySign: function(appId, merchantSecret, timestamp, nonceStr, package) {
      var data = { appId: appId, timeStamp: timestamp, nonceStr: nonceStr, package: package, signType: 'MD5' };
      var baseStr = wx.urlencodify(data);
      return wx.md5Signature(baseStr + '&key=' + merchantSecret).toUpperCase();
    }
  },

  _parseResponse: function(returns) {
    return returns[0];
  }

};

function simpleExtend(obj, ext) {
  return Object.keys(ext).reduce(function(sofar, prop) {
    sofar[prop] = ext[prop];
    return sofar;
  }, obj)
}

function extend() {
  var exts = [].slice.call(arguments);
  var extended = {};

  exts.forEach(function(ext) {
    extended = simpleExtend(extended, ext);
  });

  return extended;
}

function promisify(func) {
  return function() {
    var args = [].slice.call(arguments);
    return new Promise(function(resolve, reject) {
      args.push(function() {
        var returns = [].slice.call(arguments);
        var err = returns[0], rest = returns.slice(1);
        if (err) {
          reject(err);
        } else {
          resolve(rest);
        }
      });

      func.apply(request, args);
    });
  };
}
