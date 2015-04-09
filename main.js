var Module = {
  print: function(text) {console.log(text)},
  printErr: function(text) {console.error(text)},
  onRuntimeInitialized: function() {
    angular.bootstrap(document, ['complxApp']);
    angular.element($(".controller")).scope().autoScroll();
  },
  noInitialRun: true,
  noExitRuntime: true
}

angular.module('complxApp', ['sf.virtualScroll'])

.controller('complxController', ['$scope', 'Module', 'constants', 'settings', 'util', 'throttle',
  function($scope, Module, constants, settings, util, throttle) {
    $scope.constants = constants;
    $scope.settings = settings;
    $scope.util = util;
    $scope.module = Module;
    $scope.running = false;
    
    $scope.lc3_state = function() {
      var lc3_state = new Module.lc3_state();
      $scope.module.lc3_init(lc3_state, true);

      if ($scope.settings.autoSave) {
        var str = localStorage.getItem("lc3-state");
        if (str !== null) {
          var buf = $scope.module.HEAPU16;
          var start = lc3_state.$$.ptr >> 1;
          var strLen = str.length;
          for (var i = 0; i < strLen; i++) {
            buf[start + i] = str.charCodeAt(i);
          }
        }
      }
      return lc3_state;
    }();
    
    $scope.resetMachine = function() {
      var old = $scope.lc3_state;
      $scope.lc3_state = new Module.lc3_state();
      Module._free(old);
      Module.lc3_init($scope.lc3_state, true);
      $scope.autoScroll();
    }

    $scope.autoScroll = function() {      
      $scope.scrollTo($scope.lc3_state.pc);
    };

    $scope.scrollTo = function(addr) {
      $(".viewport").scrollTop(addr * 31 - $(".viewport").height()/2); 
    }

    if ($scope.settings.autoSave) {
      $scope.$watch(throttle(function() {
        var lc3_state_size = 132136; // hardcoded sizeof(lc3_state) !!!
        var ptr = $scope.lc3_state.$$.ptr;

        var save = String.fromCharCode.apply(null, $scope.module.HEAPU16.subarray(ptr >> 1, (ptr + lc3_state_size) >> 1));
        localStorage.setItem("lc3-state", save);
        //console.log("Saving...");
      }, 1000));
    }
  }
])

.controller('actionController', ['$scope', function($scope) {
  $scope.buttons = ["Run", "Run For", "Step", "Back", "Next Line", "Prev Line", "Finish", "Rewind"];
  
  $scope.doRun = function() {
    if (!$scope.running) {
      $scope.running = true;
      $scope.module.lc3_run($scope.lc3_state);
    } else {
      $scope.stopRunning();
      $scope.running = false;
      $scope.autoScroll();
    }
  };
  
  $scope.stopRunning = function() {
    $scope.module.ccall("emscripten_cancel_main_loop"); 
  };
}])

.controller('memController', ['$scope', function($scope) {
  $scope.mem = function() {
    var arr = [];
    for (var addr = 0; addr < $scope.constants.MEM_SIZE; addr++) {
      arr.push(
        function(addr) {
          return function(newValue) {
            if (angular.isDefined(newValue)) {
              $scope.module.setValue(
                $scope.lc3_state.getMem() + $scope.constants.SHORT_SIZE * addr,
                newValue,
                $scope.constants.SHORT_TYPE
              );
            } else {
              return 0x100000 + $scope.module.getValue(
                $scope.lc3_state.getMem() + $scope.constants.SHORT_SIZE * addr,
                $scope.constants.SHORT_TYPE
              );
            }
          }
        }(addr)
      );
    }
    return arr;
  }();

  $scope.label = function() {
    var arr = [];
    for (var addr = 0; addr < $scope.constants.MEM_SIZE; addr++) {
      arr.push(
        function(addr) {
          return function(newValue) {
            if (angular.isDefined(newValue)) {
              var old = $scope.module.lc3_sym_rev_lookup($scope.lc3_state, addr);
              if (old !== "") {
                $scope.module.lc3_sym_delete($scope.lc3_state, old);
              }
              var data = $scope.module.lc3_sym_lookup($scope.lc3_state, newValue);
              if (data === -1) {
                $scope.module.lc3_sym_add($scope.lc3_state, newValue, addr); 
              } else {
                alert("BAD STUDENT! The symbol " + newValue + " already exists at address 0x"
                      + $scope.util.shortToHexString(addr));
              }
            } else {
              return $scope.module.lc3_sym_rev_lookup($scope.lc3_state, addr);
            }
          }
        }(addr)
      );
    }
    return arr;
  }();
}])

.controller('regController', ['$scope', function($scope) {
  $scope.reg = function() {
    var arr = [];
    for (var addr = 0; addr < $scope.constants.REGS_SIZE; addr++) {
      arr.push(
        function(addr) {
          return function(newValue) {
            if (angular.isDefined(newValue)) {
              $scope.module.setValue(
                $scope.lc3_state.getRegs() + $scope.constants.SHORT_SIZE * addr,
                newValue,
                $scope.constants.SHORT_TYPE
              );
            } else {
              return 0x100000 + $scope.module.getValue(
                $scope.lc3_state.getRegs() + $scope.constants.SHORT_SIZE * addr,
                $scope.constants.SHORT_TYPE
              );
            }
          }
        }(addr)
      );
    }
    return arr;
  }();

  $scope.cc = function () {
    return function(newValue) {
      if (angular.isDefined(newValue)) {
        $scope.lc3_state.n = newValue.n;
        $scope.lc3_state.z = newValue.z;
        $scope.lc3_state.p = newValue.p;
      }
      return $scope.lc3_state;
    };
  }();

  $scope.pc = function(newValue) {
    if (angular.isDefined(newValue)) {
      $scope.lc3_state.pc = 0xFFFF & newValue;
    } else {
      return 0x100000 + $scope.lc3_state.pc;
    }
  };
}])

.service('util', ['constants', 'settings', function(constants, settings) {
  this.shortToHexString = function(number) {
    return '0x' + String('0000' + (number & 0xFFFF).toString(16).toUpperCase()).slice(-4); 
  };
    
  this.shortToBinaryString = function(number) {
    return String('0000000000000000' + (number & 0xFFFF).toString(2)).slice(-16);
  };
    
  this.shortToDecimal = function(number) {
    if (settings.decimalUnsigned) {
      return number & 0xFFFF;
    } else {
      return number & 0x8000 ? number | 0xFFFF0000 : number;
    }
  };
}])

.filter('inhex', function() {
  return function(number) {
    if (number !== null && number !== undefined) {
      return String('0000' + (number).toString(16).toUpperCase()).slice(-4);
    }
  };
})

.directive('cc', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(value) {
        if (value == 'n' || value == 'N') {
          return {n:1, z:0, p:0};
        } else if (value == 'z' || value == 'Z') {
          return {n:0, z:1, p:0};
        } else if (value == 'p' || value == 'P') {
          return {n:0, z:0, p:1};
        } else {
          return undefined;
        }
      });
      ngModel.$formatters.push(function(value) {
        return value.n ? 'n' : value.z ? 'z' : value.p ? 'p' : undefined;
      });
    }
  };
})

.directive('hex', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(value) {
        return /^(0x)?[0-9A-Fa-f]*$/.test(value) ? 0xFFFF & parseInt(value, 16) : undefined;
      });
      ngModel.$formatters.push(function(value) {
        return scope.util.shortToHexString(value & 0xFFFF);
      });
    }
  };
})

.directive('decimal', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(value) {
        // validation done since type=number
        return 0xFFFF & parseInt(value, 10);
      });
      ngModel.$formatters.push(function(value) {
        return scope.util.shortToDecimal(value & 0xFFFF);
      });
    }
  };
})

.directive('binary', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(value) {
        return /^[01]*$/.test(value) ? 0xFFFF & parseInt(value, 2) : undefined;
      });
      ngModel.$formatters.push(function(value) {
        return scope.util.shortToBinaryString(value & 0xFFFF);
      });
    }
  };
})

.directive('disassemble', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {
      ngModel.$parsers.push(function(value) {
        try {
          return scope.module.lc3_assemble_one(scope.lc3_state, scope.addr, value, -1, false, false, false, false);
        } catch (e) {
          alert("BAD STUDENT: " + Pointer_stringify(e));
          scope.module._free(e);
        }
      });
      ngModel.$formatters.push(function(value) {
        value = value & 0xFFFF
        var ret;
        var pc = scope.lc3_state.pc;
        scope.lc3_state.pc = scope.addr + 1;
        switch(scope.settings.disassemble) {
          case scope.constants.DISASSEMBLE.BASIC:
            ret = scope.module.lc3_basic_disassemble(scope.lc3_state, value);
            break;
          case scope.constants.DISASSEMBLE.REGULAR:
            ret = scope.module.lc3_disassemble(scope.lc3_state, value);
            break;
          case scope.constants.DISASSEMBLE.SMART:
            ret = scope.module.lc3_smart_disassemble(scope.lc3_state, value);
            break;
        }
        scope.lc3_state.pc = pc;
        return ret;
      });
    }
  };
})

.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if(event.which === 13) {
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
})

.factory('throttle', function() {
  return function(callback, delay) {
    var last_exec = 0;
    var timeout_id;

    return function() {
      var that = this;
      var elapsed = +new Date() - last_exec;
      function exec() {
        last_exec = +new Date();
        callback.apply(that);
      }
      timeout_id && clearTimeout(timeout_id);
      if (elapsed > delay) {
        exec();
      } else {
        timeout_id = setTimeout(exec, delay - elapsed);
      }
    }
  }
})

.service('constants', function() {
  this.SHORT_TYPE = 'i16';
  this.SHORT_SIZE =  2;

  this.MEM_START = 0x3000;
  this.MEM_SIZE = 0x10000;
  this.MEM_RANGE = Array.apply(null, {length: this.MEM_SIZE}).map(Number.call, Number);

  this.REGS_SIZE = 8;

  this.DISASSEMBLE = Object.freeze({
    BASIC: 1,
    REGULAR: 2,
    SMART: 3
  });
})

.service('settings', function() {
  this.decimalUnsigned = false;
  this.disassemble = 3; // REGULAR

  this.autoSave = typeof(localStorage) !== "undefined";
})

.value('Module', Module);
