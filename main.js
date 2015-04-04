var Module = {
  print: function(text) {console.log(text)},
  printErr: function(text) {console.error(text)},
}

angular.module('complxApp', ['sf.virtualScroll'])
.controller('complxController', ['$scope', 'Module', function($scope, Module) {
  Module['onRuntimeInitialized'] = function() {
    $scope.module = Module;
    $scope.lc3_state = new Module.lc3_state();
  }
  $scope.registers = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'CC', 'PC'];
  $scope.memRange = Array.apply(null, {length: 0xFFFF}).map(Number.call, Number);
}])
.value('Module', Module)
.filter('hex', function() {
  return function(number) {
    if (number !== null && number !== undefined) {
      return String("0000" + number.toString(16).toUpperCase()).slice(-4);
    }
  }
});


$(document).ready(
  function() {
    $(".viewport").scrollTop(0x3000*31);
  }
);
