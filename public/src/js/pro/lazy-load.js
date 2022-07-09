import { getjQuery, typeCheckConfig, onDOMContentLoaded } from '../mdb/util/index';
import Data from '../mdb/dom/data';
import EventHandler from '../mdb/dom/event-handler';
import Manipulator from '../mdb/dom/manipulator';
import SelectorEngine from '../mdb/dom/selector-engine';
import Animate from './animate';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'lazyLoad';
const DATA_KEY = 'mdb.lazyLoad';

const CLASSNAME_LAZYLOAD = 'lazy';
const SELECTOR_LAZYLOAD = '.lazy';
const EVENT_LOAD = 'onLoad.mdb.lazy';
const EVENT_ERROR = 'onError.mdb.lazy';
const SELECTOR_ELEMENTS = ['img', 'video'];

const DefaultType = {
  lazySrc: '(string || null)',
  lazyDelay: 'number',
  lazyAnimation: 'string',
  lazyOffset: 'number',
  lazyPlaceholder: '(string || undefined)',
  lazyError: '(string || undefined)',
};

const Default = {
  lazySrc: null,
  lazyDelay: 500,
  lazyAnimation: 'fade-in',
  lazyOffset: 0,
};

class LazyLoad {
  constructor(element, data) {
    this._element = element;

    if (this._element) {
      Data.setData(element, DATA_KEY, this);
    }

    this._options = this._getConfig(data);

    this.scrollHandler = this._scrollHandler.bind(this);

    this.errorHandler = this._setElementError.bind(this);

    this._childrenInstances = null;

    this._init();
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get offsetValues() {
    return this._element.getBoundingClientRect();
  }

  get inViewport() {
    if (this.parent) {
      const parentRect = this.parent.getBoundingClientRect();
      return (
        parentRect.y > 0 &&
        parentRect.y < window.innerHeight &&
        this.offsetValues.y >= parentRect.y &&
        this.offsetValues.y <= parentRect.y + parentRect.height &&
        this.offsetValues.y <= window.innerHeight
      );
    }

    return (
      this.offsetValues.top + this._options.lazyOffset <= window.innerHeight &&
      this.offsetValues.bottom >= 0
    );
  }

  get parent() {
    const [container] = SelectorEngine.parents(this._element, SELECTOR_LAZYLOAD);
    return container;
  }

  get node() {
    return this._element.nodeName;
  }

  get isContainer() {
    return !SelectorEngine.matches(this._element, SELECTOR_ELEMENTS);
  }

  // Public

  dispose() {
    Data.removeData(this._element, DATA_KEY);
    if (this._animation) {
      this._animation.dispose();
      this._animation = null;
    }

    this._element = null;

    if (this._childrenInstances) {
      this._childrenInstances.forEach((child) => child.dispose());
    }
  }

  // Private

  _init() {
    Manipulator.addClass(this._element, CLASSNAME_LAZYLOAD);

    if (this.isContainer) {
      this._setupContainer();
      return;
    }

    this._setupElement();
  }

  _setupElement() {
    EventHandler.on(this._element, 'error', this.errorHandler);

    if (this._options.lazyPlaceholder) {
      this._setPlaceholder();
    }

    this._animation = new Animate(this._element, {
      animation: this._options.lazyAnimation,
      start: 'onLoad',
    });

    EventHandler.one(this._element, 'load', () => this._scrollHandler());
    if (this.parent) {
      EventHandler.on(this.parent, 'scroll', this.scrollHandler);
    }

    EventHandler.on(window, 'scroll', this.scrollHandler);
  }

  _scrollHandler() {
    if (this.inViewport) {
      this._timeout = setTimeout(() => {
        this._setSrc();

        this._element.classList.remove(CLASSNAME_LAZYLOAD);

        this._removeAttrs();

        this._animation.init();
      }, this._options.lazyDelay);

      if (this.parent) {
        EventHandler.off(this.parent, 'scroll', this.scrollHandler);
      }

      EventHandler.off(window, 'scroll', this.scrollHandler);
    }
  }

  _setElementError() {
    this._element.setAttribute('src', this._options.lazyError);

    EventHandler.trigger(this._element, EVENT_ERROR);
  }

  _setSrc() {
    this._element.setAttribute('src', this._options.lazySrc);

    EventHandler.trigger(this._element, EVENT_LOAD);
  }

  _setPlaceholder() {
    if (this.node === 'IMG') {
      this._element.setAttribute('src', this._options.lazyPlaceholder);
    } else if (this.node === 'VIDEO') {
      this._element.setAttribute('poster', this._options.lazyPlaceholder);
    }
  }

  _removeAttrs() {
    ['src', 'delay', 'animation', 'placeholder', 'offset', 'error'].forEach((attr) => {
      Manipulator.removeDataAttribute(this._element, `lazy-${attr}`);
    });
  }

  _setupContainer() {
    this._childrenInstances = SelectorEngine.children(this._element, SELECTOR_ELEMENTS).map(
      (child) => new LazyLoad(child, this._options)
    );
  }

  _getConfig(options) {
    const config = {
      ...Default,
      ...options,
      ...Manipulator.getDataAttributes(this._element),
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
        data = new LazyLoad(this, _config);
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

SelectorEngine.find(SELECTOR_LAZYLOAD).forEach((lazy) => {
  let instance = LazyLoad.getInstance(lazy);
  if (!instance) {
    instance = new LazyLoad(lazy);
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
    $.fn[NAME] = LazyLoad.jQueryInterface;
    $.fn[NAME].Constructor = LazyLoad;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return LazyLoad.jQueryInterface;
    };
  }
});

export default LazyLoad;
