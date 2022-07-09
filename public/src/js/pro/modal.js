import {
  getjQuery,
  typeCheckConfig,
  getElementFromSelector,
  onDOMContentLoaded,
} from '../mdb/util/index';
import SelectorEngine from '../mdb/dom/selector-engine';
import EventHandler from '../mdb/dom/event-handler';
import Data from '../mdb/dom/data';
import Manipulator from '../mdb/dom/manipulator';
import BSModal from '../bootstrap/mdb-prefix/modal';
import { reset as scrollBarReset } from '../mdb/util/scrollbar';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'modal';
const DATA_KEY = 'bs.modal';
const EVENT_KEY = `.${DATA_KEY}`;
const DATA_API_KEY = '.data-api';

// width below which, according to css rules, modal position changes - modal gets position relative instead of absolute.
const MODAL_CSS_BREAKPOINT = 992;

const NON_INVASIVE_CLASS = 'modal-non-invasive-open';
const NON_INVASIVE_SHOW_CLASS = 'modal-non-invasive-show';
const SHOW_CLASS = 'show';
const MODAL_CLASS = 'modal';
const MODAL_OPEN_CLASS = 'modal-open';
const MODAL_CONTENT_CLASS = 'modal-content';
const MODAL_BOTTOM_CLASS = 'modal-bottom';
const MODAL_BOTTOM_RIGHT_CLASS = 'modal-bottom-right';
const MODAL_BOTTOM_LEFT_CLASS = 'modal-bottom-left';
const MODAL_TOP_RIGHT_CLASS = 'modal-top-right';
const MODAL_TOP_LEFT_CLASS = 'modal-top-left';
const MODAL_DIALOG_SCROLLABLE_CLASS = 'modal-dialog-scrollable';

const SELECTOR_DATA_TOGGLE = '[data-mdb-toggle="modal"]';
const SELECTOR_MODAL_CONTENT = `.${MODAL_CONTENT_CLASS}`;
const SELECTOR_MODAL_BOTTOM = `.${MODAL_BOTTOM_CLASS}`;
const SELECTOR_MODAL_BOTTOM_RIGHT = `.${MODAL_BOTTOM_RIGHT_CLASS}`;
const SELECTOR_MODAL_BOTTOM_LEFT = `.${MODAL_BOTTOM_LEFT_CLASS}`;
const SELECTOR_MODAL_TOP_RIGHT = `.${MODAL_TOP_RIGHT_CLASS}`;
const SELECTOR_MODAL_TOP_LEFT = `.${MODAL_TOP_LEFT_CLASS}`;
const SELECTOR_MODAL_DIALOG_SCROLLABLE = `.${MODAL_DIALOG_SCROLLABLE_CLASS}`;

const EVENT_MOUSEDOWN_DATA_API = `mousedown${EVENT_KEY}${DATA_API_KEY}`;
const EVENT_SHOW_BS_MODAL = `show${EVENT_KEY}`;
const EVENT_SHOWN_BS_MODAL = `shown${EVENT_KEY}`;
const EVENT_HIDDEN_BS_MODAL = `hidden${EVENT_KEY}`;
const EVENT_HIDE_BS_MODAL = 'hide.bs.modal';
const EVENT_HIDE_PREVENTED_BS_MODAL = 'hidePrevented.bs.modal';

const EVENT_HIDE = 'hide.mdb.modal';
const EVENT_HIDE_PREVENTED = 'hidePrevented.mdb.modal';
const EVENT_HIDDEN = 'hidden.mdb.modal';
const EVENT_SHOW = 'show.mdb.modal';
const EVENT_SHOWN = 'shown.mdb.modal';

const Default = {
  backdrop: true,
  keyboard: true,
  focus: true,
  show: true,
  modalNonInvasive: false,
};

const DefaultType = {
  backdrop: '(boolean|string)',
  keyboard: 'boolean',
  focus: 'boolean',
  show: 'boolean',
  modalNonInvasive: 'boolean',
};

class Modal extends BSModal {
  constructor(element, data) {
    super(element, data);
    this._config = this._getConfig(data);
    this._modalRect = '';
    this._modalComputedStyles = '';
    this._isNonInvasive = this._config.modalNonInvasive;
    this._isScrollable = '';
    this._isBottomRight = '';
    this._isBottomLeft = '';
    this._isTopRight = '';
    this._isTopLeft = '';
    this._isSideTopModal = '';
    this._isSideBottomModal = '';
    this._isSideModal = '';
    this._isModalBottom = '';

    if (this._isNonInvasive) {
      this._config.backdrop = false;
      this._config.focus = false;
      this._isBodyOverflowing = true;
      this._onModalShow();
      this._onModalShown();
      this._onModalHidden();
    }
    Data.setData(element, DATA_KEY, this);

    this._bindEvents();
  }

  // Getters
  static get NAME() {
    return NAME;
  }

  // Public
  dispose() {
    EventHandler.off(this._element, EVENT_SHOW_BS_MODAL);
    EventHandler.off(this._element, EVENT_SHOWN_BS_MODAL);
    EventHandler.off(this._element, EVENT_HIDE_BS_MODAL);
    EventHandler.off(this._element, EVENT_HIDDEN_BS_MODAL);
    EventHandler.off(this._element, EVENT_HIDE_PREVENTED_BS_MODAL);

    this._modalRect = null;
    this._modalComputedStyles = null;
    this._isNonInvasive = null;
    this._isScrollable = null;
    this._isBottomRight = null;
    this._isBottomLeft = null;
    this._isTopRight = null;
    this._isTopLeft = null;
    this._isSideTopModal = null;
    this._isSideBottomModal = null;
    this._isSideModal = null;
    this._isModalBottom = null;

    super.dispose();
  }

  // Private
  _onModalShow() {
    EventHandler.on(this._element, EVENT_SHOW_BS_MODAL, () => {
      this._addNonInvasiveClass();
    });
  }

  _onModalShown() {
    EventHandler.on(this._element, EVENT_SHOWN_BS_MODAL, () => {
      const modalDialog = SelectorEngine.findOne(SELECTOR_MODAL_CONTENT, this._element);

      this._isScrollable = SelectorEngine.findOne(SELECTOR_MODAL_DIALOG_SCROLLABLE, this._element);
      this._isBottomRight = SelectorEngine.findOne(SELECTOR_MODAL_BOTTOM_RIGHT, this._element);
      this._isBottomLeft = SelectorEngine.findOne(SELECTOR_MODAL_BOTTOM_LEFT, this._element);
      this._isTopRight = SelectorEngine.findOne(SELECTOR_MODAL_TOP_RIGHT, this._element);
      this._isTopLeft = SelectorEngine.findOne(SELECTOR_MODAL_TOP_LEFT, this._element);
      this._isSideTopModal = this._isTopLeft || this._isTopRight;
      this._isSideBottomModal = this._isBottomLeft || this._isBottomRight;
      this._isSideModal = this._isSideTopModal || this._isSideBottomModal;
      this._isModalBottom = SelectorEngine.findOne(SELECTOR_MODAL_BOTTOM, this._element);
      this._modalRect = modalDialog.getBoundingClientRect();
      this._modalComputedStyles = window.getComputedStyle(modalDialog);

      this._addOpenClass();
      this._setStyles();
    });
  }

  _adjustDialog() {
    super._adjustDialog();
    const isNonInvasiveModalOpen = document.body.classList.contains(NON_INVASIVE_CLASS);

    if (this._isNonInvasive || isNonInvasiveModalOpen) {
      this._isBodyOverflowing = false;
    }

    if (this._isNonInvasive) {
      this._backdrop.hide();
      this._resetAdjustments();
      scrollBarReset();
    }
  }

  _onModalHidden() {
    EventHandler.on(this._element, EVENT_HIDDEN_BS_MODAL, (e) => {
      // Prevent Bootstrap default behavior - focus the button after closing the modal. Users still can use this event
      e.stopImmediatePropagation();
      this._removeOpenClass();
      this._resetStyles();
      this._removeNonInvasiveClass();
    });
  }

  _addOpenClass() {
    this._element.classList.add(NON_INVASIVE_SHOW_CLASS);
  }

  _removeOpenClass() {
    this._element.classList.remove(NON_INVASIVE_SHOW_CLASS);
  }

  _addNonInvasiveClass() {
    document.body.classList.add(NON_INVASIVE_CLASS);
  }

  _removeNonInvasiveClass() {
    const isOtherModalOpen = SelectorEngine.findOne(
      `.${MODAL_CLASS}.${SHOW_CLASS}.${NON_INVASIVE_SHOW_CLASS}`,
      document.body
    );

    if (!isOtherModalOpen) {
      document.body.classList.remove(NON_INVASIVE_CLASS);
    } else {
      // if other modal open add bootstrap modal open class back
      document.body.classList.add(MODAL_OPEN_CLASS);
    }
  }

  _setStyles() {
    const isAboveBreakpoint = window.innerWidth >= MODAL_CSS_BREAKPOINT;
    this._element.style.left = `${this._modalRect.left}px`;
    this._element.style.width = this._modalComputedStyles.width;

    if (!this._isScrollable) {
      this._element.style.height = this._modalComputedStyles.height;
      this._element.style.display = '';
    }

    if (isAboveBreakpoint) {
      if (this._isSideBottomModal || this._isModalBottom) {
        this._element.style.top = `${this._modalRect.top}px`;
      }

      if (this._isSideModal) {
        this._element.style.overflowX = 'auto';
      }
    }
  }

  _resetStyles() {
    this._element.style.left = '';
    this._element.style.top = '';
    this._element.style.height = '';
    this._element.style.width = '';

    if (!this._isScrollable) {
      this._element.style.display = '';
    }

    if (this._isSideModal) {
      this._element.style.overflowX = '';
    }
  }

  _getConfig(options) {
    let target;
    if (this._element) {
      target = getElementFromSelector(this._element);
    }

    const config = {
      ...Default,
      ...Manipulator.getDataAttributes(this._element),
      ...Manipulator.getDataAttributes(target),
      ...options,
    };
    typeCheckConfig(NAME, config, DefaultType);
    return config;
  }

  // Private
  _bindEvents() {
    this._bindShowEvent();
    this._bindShownEvent();
    this._bindHideEvent();
    this._bindHiddenEvent();
    this._bindHidePreventedEvent();
  }

  _bindShowEvent() {
    EventHandler.on(this._element, EVENT_SHOW_BS_MODAL, (e) => {
      EventHandler.trigger(this._element, EVENT_SHOW, { relatedTarget: e.relatedTarget });
    });
  }

  _bindShownEvent() {
    EventHandler.on(this._element, EVENT_SHOWN_BS_MODAL, (e) => {
      EventHandler.trigger(this._element, EVENT_SHOWN, { relatedTarget: e.relatedTarget });
    });
  }

  _bindHideEvent() {
    EventHandler.on(this._element, EVENT_HIDE_BS_MODAL, () => {
      EventHandler.trigger(this._element, EVENT_HIDE);
    });
  }

  _bindHiddenEvent() {
    EventHandler.on(this._element, EVENT_HIDDEN_BS_MODAL, () => {
      EventHandler.trigger(this._element, EVENT_HIDDEN);
    });
  }

  _bindHidePreventedEvent() {
    EventHandler.on(this._element, EVENT_HIDE_PREVENTED_BS_MODAL, () => {
      EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
    });
  }

  // Static

  static jQueryInterface(config, relatedTarget) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = {
        ...Default,
        ...Manipulator.getDataAttributes(this),
        // eslint-disable-next-line no-extra-parens
        ...(typeof config === 'object' && config ? config : {}),
      };

      if (!data) {
        data = new Modal(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config](relatedTarget);
      } else if (_config.show) {
        data.show(relatedTarget);
      }
    });
  }
}

/**
 * ------------------------------------------------------------------------
 * Data Api implementation - auto initialization
 * ------------------------------------------------------------------------
 */

EventHandler.on(document, EVENT_MOUSEDOWN_DATA_API, SELECTOR_DATA_TOGGLE, function (e) {
  const target = getElementFromSelector(e.target);

  let data = Data.getData(target, DATA_KEY);
  if (!data) {
    const config = {
      ...Manipulator.getDataAttributes(target),
      ...Manipulator.getDataAttributes(this._element),
    };

    data = new Modal(target, config);
  }
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 * add .modal to jQuery only if jQuery is present
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Modal.jQueryInterface;
    $.fn[NAME].Constructor = Modal;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Modal.jQueryInterface;
    };
  }
});

export default Modal;
