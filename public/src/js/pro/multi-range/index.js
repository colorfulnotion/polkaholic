import { getjQuery, typeCheckConfig, onDOMContentLoaded } from '../../mdb/util/index';
import EventHandler, { EventHandlerMulti } from '../../mdb/dom/event-handler';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import Data from '../../mdb/dom/data';
import { getConnectsTemplate, getHandleTemplate, getTooltipTemplate } from './template';
import { getEventTypeClientX } from './utils';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'multiRangeSlider';
const SELECTOR_MULTI = 'multi-range-slider';
const SELECTOR_MULTI_RANGE = '.multi-range-slider';
const DATA_KEY = 'mdb.multiRangeSlider';

const EVENT_SHOW_PERCENT = 'showPercent.mdb.multiRangeSlider';
const EVENT_VALUE = 'value.mdb.multiRangeSlider';
const EVENT_START = 'start.mdb.multiRangeSlider';

const CLASSNAME_HAND = '.multi-range-slider-hand';
const CLASSNAME_CONNECT = '.multi-range-slider-connect';
const CLASSNAME_TOOLTIP = '.multi-range-slider-tooltip';

const SELECTOR_ACTIVE = 'active';
const SELECTOR_HORIZONTAL = 'multi-range-slider-horizontal';
const SELECTOR_VERTICAL = 'multi-range-slider-vertical';

const DefaultType = {
  direction: 'string',
  margin: '(string||number||null)',
  max: 'number',
  min: 'number',
  numberOfRanges: 'number',
  orientation: 'string',
  padding: '(string||number||null)',
  startValues: 'array',
  step: '(string||null||number)',
  tooltips: 'boolean',
};

const Default = {
  direction: '',
  margin: null,
  max: 100,
  min: 0,
  numberOfRanges: 2,
  orientation: 'horizontal',
  padding: null,
  startValues: [0, 100],
  step: null,
  tooltips: false,
};

class MultiRangeSlider {
  constructor(element, data = {}) {
    this._element = element;
    this._options = this._getConfig(data);
    this._mousemove = false;

    this.init();
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get hands() {
    return SelectorEngine.find(CLASSNAME_HAND, this._element);
  }

  get connect() {
    return SelectorEngine.findOne(CLASSNAME_CONNECT, this._element);
  }

  get leftConnectRect() {
    return this.connect.getBoundingClientRect().left;
  }

  get handsNoActive() {
    return this.hands.filter((hand) => !Manipulator.hasClass(hand, 'active'));
  }

  get handActive() {
    return SelectorEngine.findOne(`${CLASSNAME_HAND}.active`);
  }

  get activeTooltip() {
    return SelectorEngine.findOne(CLASSNAME_TOOLTIP);
  }

  get activeTooltipValue() {
    const handTooltip = SelectorEngine.findOne(`${CLASSNAME_HAND}.active`);

    // fast fix to correct in future
    const tooltip = handTooltip.children[1].children[0];
    return tooltip;
  }

  // Public

  init() {
    this._setClassHorizontalOrVertical();
    this._setRangeConnectsElement();
    this._setRangeHandleElements();
    this._setTransofrmationOnStart();
    this._handleClickEventOnHand();
    this._handleEndMoveEventDocument();
    this._handleClickOnRange();
    this._setValueEventOnMouseDown();
    this._setPercentEventOnMouseDown();
    this._setTooltipToHand();
  }

  dispose() {
    Data.removeData(this._element, DATA_KEY);

    this._element = null;
    this._input = null;
    this._options = null;
    this._view = null;
    this._focusTrap = null;
  }

  // Private

  _setTransofrmationOnStart() {
    const { startValues, max, min } = this._options;

    if (startValues.length === 0) {
      this.hands.forEach((hand) => {
        const translation = -hand.offsetWidth;

        Manipulator.setDataAttribute(hand, 'translation', Math.round(translation));

        Manipulator.addStyle(hand, {
          transform: `translate(${translation}px,-25%)`,
        });
      });
    } else {
      this.hands.forEach((hand, i) => {
        if (startValues[i] > max || startValues[i] < min) return;
        const translation =
          (startValues[i] * this.connect.offsetWidth) / max - hand.offsetWidth / 2;

        Manipulator.setDataAttribute(hand, 'translation', Math.round(translation));

        Manipulator.addStyle(hand, {
          transform: `translate(${translation}px,-25%)`,
        });
      });
    }
  }

  _handleClickEventOnHand() {
    const { max, min } = this._options;
    this.hands.forEach((hand, index) => {
      EventHandlerMulti.on(hand, 'mousedown touchstart', (ev) => {
        this._mousemove = true;
        const translation = getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2;

        const value =
          ((getEventTypeClientX(ev) - this.leftConnectRect) /
            (this.connect.offsetWidth / (max - min))) %
          (max - min);

        Manipulator.addStyle(hand, {
          transform: `translate(${translation}px,-25%)`,
        });

        Manipulator.setDataAttribute(hand, 'translation', translation);

        Manipulator.addClass(hand, SELECTOR_ACTIVE);

        if (this._options.tooltip) {
          Manipulator.addClass(hand.children[1], 'active');
          this.activeTooltipValue.innerText = Math.round(value);
        }

        this._handleMoveEvent(hand, index);
        this._handleEndMoveEvent(hand, ev);
      });
    });
  }

  _setPercentEventOnMouseDown() {
    EventHandlerMulti.on(this.connect, 'mousedown touchstart', (ev) => {
      const value = (getEventTypeClientX(ev) - this.leftConnectRect) / ev.target.offsetWidth;
      const percent = `${Math.round(value * 100)}%`;

      EventHandler.trigger(this._element, EVENT_SHOW_PERCENT, {
        percents: { value, percent },
      });
    });
  }

  _setValueEventOnMouseDown() {
    EventHandlerMulti.on(this.connect, 'mousedown touchstart', (ev) => {
      const { max, min, numberOfRanges } = this._options;

      if (numberOfRanges < 2) {
        const value =
          Math.round(
            (getEventTypeClientX(ev) - this.leftConnectRect) / (ev.target.offsetWidth / (max - min))
          ) %
          (max - min);

        EventHandler.trigger(this._element, EVENT_START, {
          values: { value: value + min, rounded: Math.round(value + min) },
        });
      }
    });
  }

  _setClassHorizontalOrVertical() {
    Manipulator.addClass(this._element, SELECTOR_MULTI);

    if (this._options.orientation === 'horizontal') {
      Manipulator.addClass(this._element, SELECTOR_HORIZONTAL);
    } else {
      Manipulator.addClass(this._element, SELECTOR_VERTICAL);
    }
  }

  _setRangeConnectsElement() {
    this._element.insertAdjacentHTML('afterbegin', getConnectsTemplate());
  }

  _setRangeHandleElements() {
    for (let i = 0; i < this._options.numberOfRanges; i++) {
      this._element.insertAdjacentHTML('beforeend', getHandleTemplate());
    }

    this.hands.forEach((hand, i) => {
      hand.setAttribute('aria-orientation', this._options.orientation);
      hand.setAttribute('role', 'slider');

      Manipulator.setDataAttribute(hand, 'handle', i);
    });
  }

  _setTooltipToHand() {
    if (this._options.tooltips) {
      this.hands.forEach((hand) => {
        return hand.insertAdjacentHTML('beforeend', getTooltipTemplate());
      });
    }
  }

  _handleMoveEvent(hand) {
    const { tooltip, step } = this._options;

    EventHandlerMulti.on(document, 'mousemove touchmove', (ev) => {
      if (ev.type === 'mousemove') ev.preventDefault();

      const { max, min, numberOfRanges } = this._options;

      if (Manipulator.hasClass(hand, SELECTOR_ACTIVE)) {
        const maxValue =
          ((getEventTypeClientX(ev) - this.leftConnectRect) / this.connect.offsetWidth) * max;
        let value =
          (((getEventTypeClientX(ev) - this.leftConnectRect) /
            (this.connect.offsetWidth / (max - min))) %
            (max - min)) +
          min;

        let translation = getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2;

        const handActiveHandle = Manipulator.getDataAttribute(this.handActive, 'handle');
        const handActiveTranslation = Manipulator.getDataAttribute(this.handActive, 'translation');
        if (value < min) {
          translation = min - hand.offsetWidth;
          value = min;
        } else if (maxValue >= max) {
          return;
        }

        const handleDataHandle = this.handsNoActive.map((hand) =>
          Manipulator.getDataAttribute(hand, 'handle')
        );
        const handleDataTranslate = this.handsNoActive.map((hand) =>
          Manipulator.getDataAttribute(hand, 'translation')
        );

        if (handActiveHandle < handleDataHandle && handActiveTranslation <= handleDataTranslate) {
          if (Math.round(value) % step === 0 && step !== null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          } else if (step === null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          }
        } else if (
          handActiveHandle > handleDataHandle &&
          handActiveTranslation >= handleDataTranslate
        ) {
          if (Math.round(value) % step === 0 && step !== null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          } else if (step === null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          }
        }

        if (numberOfRanges < 2) {
          if (Math.round(value) % step === 0 && step !== null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          } else if (step === null) {
            Manipulator.addStyle(hand, {
              transform: `translate(${translation}px,-25%)`,
            });

            if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
          }
        }

        Manipulator.setDataAttribute(hand, 'translation', translation);

        if (numberOfRanges < 2) {
          EventHandler.trigger(this._element, EVENT_VALUE, {
            values: { value: value + min, rounded: Math.round(value + min) },
          });
        } else {
          this._handleMultiValuesOnRange();
        }
      }
    });
  }

  _handleMultiValuesOnRange() {
    const { max, min } = this._options;
    const arr = [];

    this.hands.forEach((hand) => {
      const translation =
        hand.getBoundingClientRect().left - this.leftConnectRect + hand.offsetWidth / 2;

      let value = (translation / (this.connect.offsetWidth / (max - min))) % (max - min);

      if (translation === this.connect.offsetWidth) {
        value = max;
      } else {
        value += min;
      }

      Manipulator.setDataAttribute(hand, 'value', Math.round(value * 10) / 10);

      arr.push({ value });
    });

    EventHandler.trigger(this._element, EVENT_VALUE, {
      values: {
        value: arr.map(({ value }) => value),
        rounded: arr.map(({ value }) => Math.round(value)),
      },
    });
  }

  _handleEndMoveEventDocument() {
    EventHandlerMulti.on(document, 'mouseup touchend', () => {
      if (this._mousemove) {
        this.hands.forEach((hand) => {
          EventHandler.off(hand, 'mousemove');
          Manipulator.removeClass(hand, SELECTOR_ACTIVE);

          if (this._options.tooltip) Manipulator.removeClass(hand.children[1], 'active');
        });

        this._mousemove = false;
      }
    });
  }

  _handleEndMoveEvent(hand) {
    EventHandlerMulti.on(hand, 'mouseup touchend', () => {
      EventHandler.off(hand, 'mousemove');
      Manipulator.removeClass(hand, SELECTOR_ACTIVE);

      if (this._options.tooltip) Manipulator.removeClass(hand.children[1], 'active');

      this._mousemove = false;
    });
  }

  _handleClickOnRange() {
    EventHandlerMulti.on(this.connect, 'mousedown touchstart', (ev) => {
      this.hands.forEach((hand) => {
        Manipulator.addClass(hand, SELECTOR_ACTIVE);
        this._mousemove = true;
        if (this._options.numberOfRanges < 2) {
          Manipulator.addStyle(hand, {
            transform: `translate(${
              getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2
            }px,-25%)`,
          });
        } else {
          Manipulator.addStyle(this.hands[0], {
            transform: `translate(${
              getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2
            }px,-25%)`,
          });
        }
      });
    });
  }

  _handlePadding() {
    EventHandlerMulti.on(this.connect, 'mousedown touchstart', (ev) => {
      const { padding, numberOfRanges } = this._options;
      let value;
      if (numberOfRanges < 2) {
        value =
          Math.round(
            (getEventTypeClientX(ev) - this.leftConnectRect) / (ev.target.offsetWidth / padding)
          ) % padding;
      }

      return value;
    });
  }

  _setMovingTooltipEvent() {
    EventHandlerMulti.on(this.connect, 'mousemove', (ev) => {
      const value = (getEventTypeClientX(ev) - this.leftConnectRect) / ev.target.offsetWidth;
      const percent = `${Math.round(value * 100)}%`;
      EventHandler.trigger(this._element, 'movetooltip', {
        percents: { value, percent },
      });
    });
  }

  static jQueryInterface(config, options) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose|hide/.test(config)) {
        return;
      }

      if (!data) {
        data = new MultiRangeSlider(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config](options);
      }
    });
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

SelectorEngine.find(SELECTOR_MULTI_RANGE).forEach((range) => {
  let instance = MultiRangeSlider.getInstance(range);
  if (!instance) {
    instance = new MultiRangeSlider(range);
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
    $.fn[NAME] = MultiRangeSlider.jQueryInterface;
    $.fn[NAME].Constructor = MultiRangeSlider;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return MultiRangeSlider.jQueryInterface;
    };
  }
});

export default MultiRangeSlider;
