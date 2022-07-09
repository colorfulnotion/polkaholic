import { getjQuery, typeCheckConfig, onDOMContentLoaded } from '../../mdb/util/index';
import Data from '../../mdb/dom/data';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import EventHandler from '../../mdb/dom/event-handler';
import { getBackdropTemplate } from './templates';

const NAME = 'loading';
const CLASS_SPINNER = 'loading-spinner';
const DATA_KEY = 'mdb.loading';
const CLASS_NAME_SHOW = 'show';

const SELECTOR_LOADING = '.loading';
const SELECTOR_LOADING_ICON = '.loading-icon';
const SELECTOR_LOADING_TEXT = '.loading-text';

const SHOW_EVENT = 'show.mdb.loading';

const DefaultType = {
  backdrop: '(null|boolean)',
  backdropColor: 'string',
  backdropOpacity: '(number|string)',
  delay: '(null|number)',
  loader: 'string',
  loadingIcon: 'boolean',
  loadingText: 'boolean',
  scroll: 'boolean',
};

const Default = {
  backdrop: true,
  backdropColor: 'rgba(0, 0, 0)',
  backdropOpacity: 0.4,
  backdropID: '',
  delay: null,
  loader: '',
  parentSelector: null,
  scroll: true,
  loadingText: true,
  loadingIcon: true,
};

class Loading {
  constructor(element, options = {}) {
    this._element = element;
    this._options = this._getConfig(options);

    if (this._element) {
      Data.setData(element, DATA_KEY, this);
    }

    this._backdropElement = null;
    this._parentElement = SelectorEngine.findOne(this._options.parentSelector);

    this._loadingIcon = SelectorEngine.findOne(SELECTOR_LOADING_ICON, this._element);
    this._loadingText = SelectorEngine.findOne(SELECTOR_LOADING_TEXT, this._element);

    this.init();
  }
  // Getters

  static get NAME() {
    return NAME;
  }

  // Public

  toggle() {
    const isActive = Manipulator.hasClass(this._element, CLASS_NAME_SHOW);

    if (isActive) return;

    this.init();
  }

  init() {
    const spinnerCloned = this._loadingIcon.cloneNode(true);
    const loadingCloned = this._loadingText.cloneNode(true);

    this._removeElementsOnStart();

    setTimeout(() => {
      Manipulator.addClass(this._element, CLASS_SPINNER);

      this._setBackdrop();
      this._setLoadingIcon(spinnerCloned);
      this._setLoadingText(loadingCloned);
      this._setScrollOption();

      EventHandler.trigger(this._element, SHOW_EVENT);
    }, this._options.delay);
  }

  dispose() {
    Data.removeData(this._element, DATA_KEY);
    this._backdropElement = null;

    this._element = null;
    this._options = null;
  }

  // Private

  _setBackdrop() {
    const { backdrop } = this._options;

    if (!backdrop) return;

    this._backdropElement = getBackdropTemplate(this._options);

    if (this._parentElement !== null) {
      Manipulator.addClass(this._element, 'position-absolute');
      Manipulator.addClass(this._parentElement, 'position-relative');
      Manipulator.addClass(this._backdropElement, 'position-absolute');

      this._parentElement.appendChild(this._backdropElement);
    } else {
      Manipulator.addClass(this._element, 'position-fixed');

      document.body.appendChild(this._backdropElement);
      document.body.appendChild(this._element);
    }
  }

  _setLoadingIcon(spinner) {
    if (!this._options.loadingIcon) {
      spinner.remove();
      return;
    }
    this._element.appendChild(spinner);
    spinner.id = this._options.loader;
  }

  _setLoadingText(text) {
    if (!this._options.loadingText) {
      text.remove();
      return;
    }

    this._element.appendChild(text);
  }

  _removeElementsOnStart() {
    if (this._element === null) return;

    this._loadingIcon.remove();
    this._loadingText.remove();
  }

  _setScrollOption() {
    if (!this._options.scroll) {
      if (this._parentElement === null) {
        document.body.style.overflow = 'hidden';
        return;
      }

      Manipulator.addStyle(this._parentElement, { overflow: 'hidden' });
    } else {
      if (this._parentElement === null) {
        document.body.style.overflow = '';
        return;
      }

      Manipulator.addStyle(this._parentElement, { overflow: '' });
    }
  }

  _getConfig(options) {
    const config = {
      ...Default,
      ...Manipulator.getDataAttributes(this._element),
      ...options,
    };
    typeCheckConfig(NAME, config, DefaultType);
    return config;
  }

  // Static

  static getInstance(element) {
    return Data.getData(element, DATA_KEY);
  }

  static getOrCreateInstance(element, config = {}) {
    return (
      this.getInstance(element) || new this(element, typeof config === 'object' ? config : null)
    );
  }

  static jQueryInterface(config) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;
      if (!data) {
        data = new Loading(this, _config);
      }
      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](this);
      }
    });
  }
}

/**
 * ------------------------------------------------------------------------
 * Data Api implementation - auto initialization
 * ------------------------------------------------------------------------
 */

SelectorEngine.find(SELECTOR_LOADING).forEach((loading) => {
  let instance = Loading.getInstance(loading);
  if (!instance) {
    instance = new Loading(loading);
  }
  return instance;
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Loading.jQueryInterface;
    $.fn[NAME].Constructor = Loading;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Loading.jQueryInterface;
    };
  }
});

export default Loading;
