import { getjQuery, typeCheckConfig, onDOMContentLoaded } from '../mdb/util/index';
import Data from '../mdb/dom/data';
import Manipulator from '../mdb/dom/manipulator';
import SelectorEngine from '../mdb/dom/selector-engine';
import EventHandler from '../mdb/dom/event-handler';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'infiniteScroll';
const DATA_KEY = 'mdb.infiniteScroll';

const SELECTOR_INFINITE_SCROLL = '.infinite-scroll';

const Default = {
  infiniteDirection: 'y',
};

const DefaultType = {
  infiniteDirection: 'string',
};

class InfiniteScroll {
  constructor(element, data) {
    this._element = element;

    if (this._element) {
      Data.setData(element, DATA_KEY, this);
    }

    this._options = this._getConfig(data);

    this.scrollHandler = this._scrollHandler.bind(this);

    this._init();
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get rect() {
    return this._element.getBoundingClientRect();
  }

  get condition() {
    if (this._element === window) {
      return window.scrollY + window.innerHeight === document.documentElement.scrollHeight;
    }
    if (this._options.infiniteDirection === 'x') {
      return this.rect.width + this._element.scrollLeft + 10 >= this._element.scrollWidth;
    }
    return this.rect.height + this._element.scrollTop >= this._element.scrollHeight;
  }

  // Public

  dispose() {
    EventHandler.off(this._element, 'scroll', this.scrollHandler);

    Data.removeData(this._element, DATA_KEY);

    this._element = null;
  }

  // Private

  _init() {
    EventHandler.on(this._element, 'scroll', () => this._scrollHandler());
  }

  _scrollHandler() {
    if (this.condition) {
      EventHandler.trigger(this._element, 'complete.mdb.infiniteScroll');
    }
    EventHandler.off(this._element, 'scroll', this.scrollHandler);
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
        data = new InfiniteScroll(this, _config);
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

SelectorEngine.find(SELECTOR_INFINITE_SCROLL).forEach((infiniteScroll) => {
  let instance = InfiniteScroll.getInstance(infiniteScroll);
  if (!instance) {
    instance = new InfiniteScroll(infiniteScroll);
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
    $.fn[NAME] = InfiniteScroll.jQueryInterface;
    $.fn[NAME].Constructor = InfiniteScroll;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return InfiniteScroll.jQueryInterface;
    };
  }
});

export default InfiniteScroll;
