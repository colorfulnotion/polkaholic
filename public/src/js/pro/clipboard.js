import { typeCheckConfig, getjQuery, element, onDOMContentLoaded } from '../mdb/util/index';
import Data from '../mdb/dom/data';
import EventHandler from '../mdb/dom/event-handler';
import Manipulator from '../mdb/dom/manipulator';
import SelectorEngine from '../mdb/dom/selector-engine';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'clipboard';
const DATA_KEY = 'mdb.clipboard';
const EVENT_KEY = `.${DATA_KEY}`;
const SELECTOR_COMPONENT = '.clipboard';

const DEFAULT_OPTIONS = {
  clipboardTarget: null,
};

const OPTIONS_TYPE = {
  clipboardTarget: 'null|string',
};

const EVENT_COPY = `copy${EVENT_KEY}`;

/**
 * ------------------------------------------------------------------------
 * Class Definition
 * ------------------------------------------------------------------------
 */

class Clipboard {
  constructor(element, options = {}) {
    this._element = element;
    this._options = options;

    if (this._element) {
      Data.setData(element, DATA_KEY, this);

      this._initCopy = this._initCopy.bind(this);

      this._setup();
    }
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get options() {
    const config = {
      ...DEFAULT_OPTIONS,
      ...Manipulator.getDataAttributes(this._element),
      ...this._options,
    };

    typeCheckConfig(NAME, config, OPTIONS_TYPE);

    return config;
  }

  get clipboardTarget() {
    return SelectorEngine.findOne(this.options.clipboardTarget);
  }

  get copyText() {
    const clipboardTextExist = this.clipboardTarget.hasAttribute('data-mdb-clipboard-text');
    const inputValue = this.clipboardTarget.value;
    const targetText = this.clipboardTarget.textContent;

    if (clipboardTextExist) {
      return this.clipboardTarget.getAttribute('data-mdb-clipboard-text');
    }

    if (inputValue) {
      return inputValue;
    }

    return targetText;
  }

  // Public

  dispose() {
    EventHandler.off(this._element, 'click', this._initCopy);

    Data.removeData(this._element, DATA_KEY);
    this._element = null;
  }

  // Private
  _setup() {
    EventHandler.on(this._element, 'click', this._initCopy);
  }

  _initCopy() {
    const inputToCopy = this._createNewInput();
    document.body.appendChild(inputToCopy);
    this._selectInput(inputToCopy);
    EventHandler.trigger(this._element, EVENT_COPY, { copyText: this.copyText });

    inputToCopy.remove();
  }

  _createNewInput() {
    const newInput = element('input');
    newInput.value = this.copyText;
    Manipulator.style(newInput, { left: '-9999px', position: 'absolute' });

    return newInput;
  }

  _selectInput(input) {
    input.select();
    input.focus();
    input.setSelectionRange(0, 99999);

    document.execCommand('copy');
  }

  // Static

  static jQueryInterface(config) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data) {
        data = new Clipboard(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](this);
      }
    });
  }

  static getInstance(element) {
    return Data.getData(element, DATA_KEY);
  }

  static getOrCreateInstance(element, config = {}) {
    return (
      this.getInstance(element) || new this(element, typeof config === 'object' ? config : null)
    );
  }
}

/**
 * ------------------------------------------------------------------------
 * Data Api implementation - auto initialization
 * ------------------------------------------------------------------------
 */

SelectorEngine.find(SELECTOR_COMPONENT).forEach((el) => {
  let instance = Clipboard.getInstance(el);
  if (!instance) {
    instance = new Clipboard(el);
  }
  return instance;
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 * add .treeview to jQuery only if jQuery is present
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Clipboard.jQueryInterface;
    $.fn[NAME].Constructor = Clipboard;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Clipboard.jQueryInterface;
    };
  }
});

export default Clipboard;
