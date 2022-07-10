/* eslint-disable import/prefer-default-export */
/* eslint-disable indent */

export const getTimepickerTemplate = ({
  format24,
  okLabel,
  cancelLabel,
  headID,
  footerID,
  bodyID,
  pickerID,
  clearLabel,
  inline,
  showClearBtn,
  amLabel,
  pmLabel,
}) => {
  const normalTemplate = `<div id='${pickerID}' class='timepicker-wrapper h-100 d-flex align-items-center justify-content-center flex-column position-fixed'>
               <div class="d-flex align-items-center justify-content-center flex-column timepicker-container">
                  <div class="d-flex flex-column timepicker-elements justify-content-around">
                  <div id='${headID}' class='timepicker-head d-flex flex-row align-items-center justify-content-center'
                  style='padding-right:${format24 ? 50 : 0}px'>
                  <div class='timepicker-head-content d-flex w-100 justify-content-evenly'>
                      <div class="timepicker-current-wrapper">
                        <span class="position-relative h-100">
                          <button type='button' class='timepicker-current timepicker-hour active ripple' tabindex="0">21</button>
                        </span>
                        <button type='button' class='timepicker-dot' disabled>:</button>
                      <span class="position-relative h-100">
                        <button type='button' class='timepicker-current timepicker-minute ripple' tabindex="0">21</button>
                      </span>
                      </div>
                      ${
                        !format24
                          ? `<div class="d-flex flex-column justify-content-center timepicker-mode-wrapper">
                              <button type='button' class="timepicker-hour-mode timepicker-am ripple" tabindex="0">${amLabel}</button>
                              <button class="timepicker-hour-mode timepicker-pm ripple" tabindex="0">${pmLabel}</button>
                            </div>`
                          : ''
                      }
                  </div>
                </div>
                ${
                  !inline
                    ? `<div id='${bodyID}' class='timepicker-clock-wrapper d-flex justify-content-center flex-column align-items-center'>
                        <div class='timepicker-clock'>
                          <span class='timepicker-middle-dot position-absolute'></span>
                          <div class='timepicker-hand-pointer position-absolute'>
                            <div class='timepicker-circle position-absolute'></div>
                          </div>
                          ${format24 ? '<div class="timepicker-clock-inner"></div>' : ''}
                         </div>
                      </div>`
                    : ''
                }

              </div>
                <div id='${footerID}' class='timepicker-footer'>
                  <div class="w-100 d-flex justify-content-between">
                    ${
                      showClearBtn
                        ? `<button type='button' class='timepicker-button timepicker-clear ripple' tabindex="0">${clearLabel}</button>`
                        : ''
                    }
                    <button type='button' class='timepicker-button timepicker-cancel ripple' tabindex="0">${cancelLabel}</button>
                    <button type='button' class='timepicker-button timepicker-submit ripple' tabindex="0">${okLabel}</button>
                  </div>
                </div>
              </div>
        </div>`;

  const inlineTemplate = `<div id='${pickerID}' class='timepicker-wrapper h-100 d-flex align-items-center justify-content-center flex-column timepicker-wrapper-inline'>
               <div class="d-flex align-items-center justify-content-center flex-column timepicker-container">
                  <div class="d-flex flex-column timepicker-elements justify-content-around timepicker-elements-inline">
                  <div id='${headID}' class='timepicker-head d-flex flex-row align-items-center justify-content-center timepicker-head-inline'
                  style='padding-right:0px'>
                  <div class='timepicker-head-content d-flex w-100 justify-content-evenly align-items-center'>
                      <div class="timepicker-current-wrapper">
                        <span class="position-relative h-100 timepicker-inline-hour-icons">
                          <i class="fas fa-chevron-up position-absolute text-white timepicker-icon-up timepicker-icon-inline-hour"></i>
                          <button type='button' class='timepicker-current timepicker-hour active ripple timepicker-current-inline' tabindex="0">21</button>
                          <i class="fas fa-chevron-down position-absolute text-white timepicker-icon-down timepicker-icon-inline-hour"></i>
                        </span>
                        <button type='button' class='timepicker-dot timepicker-current-inline' disabled>:</button>
                      <span class="position-relative h-100  timepicker-inline-minutes-icons">
                        <i class="fas fa-chevron-up position-absolute text-white timepicker-icon-up timepicker-icon-inline-minute"></i>
                        <button type='button' class='timepicker-current timepicker-minute ripple timepicker-current-inline' tabindex="0">21</button>
                        <i class="fas fa-chevron-down position-absolute text-white timepicker-icon-down timepicker-icon-inline-minute"></i>
                      </span>
                      </div>
                      ${
                        !format24
                          ? `<div class="d-flex justify-content-center timepicker-mode-wrapper">
                              <button type='button' class="timepicker-hour-mode timepicker-am ripple me-2 ms-4" tabindex="0">${amLabel}</button>
                              <button class="timepicker-hour-mode timepicker-pm ripple" tabindex="0">${pmLabel}</button>
                              <button type='button' class='timepicker-button timepicker-submit timepicker-submit-inline ripple py-1 px-2 mb-0' tabindex="0">${okLabel}</button>
                            </div>`
                          : ''
                      }
                      ${
                        format24
                          ? `<button class='timepicker-button timepicker-submit timepicker-submit-inline ripple py-1 px-2 mb-0' tabindex="0">${okLabel}</button>`
                          : ''
                      }
                  </div>
                </div>
              </div>
           </div>
        </div>
  `;

  return inline ? inlineTemplate : normalTemplate;
};

export const getToggleButtonTemplate = (options, id) => {
  const { iconClass } = options;

  return `
  <button id="${id}" tabindex="0" type="button" class="timepicker-toggle-button" data-mdb-toggle="timepicker"  >
    <i class="${iconClass}"></i>
  </button>
`;
};
