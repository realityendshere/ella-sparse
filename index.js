'use strict';

module.exports = {
  name: require('./package').name,
  isDevelopingAddon: () => {
    console.log(
      '**********************************************************ella sparse'
    );
    return true;
  },
};
