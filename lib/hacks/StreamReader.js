// Note: Generated class, no need to touch (original from maas-bpmn-engine)
// jshint ignore: start
// jscs:disable

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _stream = require('stream');

var _stream2 = _interopRequireDefault(_stream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @typedef {Object} StreamReader
 *
 * An utility to working with streams
 */

var StreamReader = function (_stream$Writable) {
  _inherits(StreamReader, _stream$Writable);

  /**
   * The default constructor: Saves the element data.
   */

  function StreamReader(readable) {
    _classCallCheck(this, StreamReader);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StreamReader).call(this));

    _this.buffers = [];
    _this.finished = false;
    _this.error = null;

    // Pipe the input of the readable stream into this
    readable.pipe(_this);

    _this.on('error', _this.handleError.bind(_this));
    return _this;
  }

  _createClass(StreamReader, [{
    key: 'write',
    value: function write(chunk, callback) {
      this.buffers.push(chunk);
    }
  }, {
    key: 'end',
    value: function end(chunk) {
      if (chunk) {
        this.buffers.push(chunk);
      }

      this.finished = true;
      this.emit('finish');
    }
  }, {
    key: 'handleError',
    value: function handleError(error) {
      this.error = error;
    }

    /**
     * Read the stream entirely
     *
     * @return Buffer containing the stream contents
     */

  }, {
    key: 'readAll',
    value: function readAll() {
      var _this2 = this;

      var resolve;
      var reject;

      // Else listen for the end or error events
      var handleFinished = function handleFinished() {
        resolve(Buffer.concat(_this2.buffers));
      };

      var handleError = function handleError(error) {
        reject(error);
      };

      var handleData = function handleData(data) {
        console.log('Dataa on');
        _this2.buffers.push(data);
      };

      return new _bluebird2.default(function (_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;

        // Check if the stream has errored already
        if (_this2.error) {
          return reject(error);
        }

        // Check if the readable is drained already
        if (_this2.finished) {
          return resolve(Buffer.concat(_this2.buffers));
        }

        _this2.once('finish', handleFinished);
        _this2.once('error', handleError);
      }).finally(function (output) {
        _this2.removeListener('finish', handleData);
        _this2.removeListener('finish', handleFinished);
        _this2.removeListener('error', handleError);
      });
    }
  }]);

  return StreamReader;
}(_stream2.default.Writable);

exports.default = StreamReader;
module.exports = exports['default'];
//# sourceMappingURL=StreamReader.js.map
