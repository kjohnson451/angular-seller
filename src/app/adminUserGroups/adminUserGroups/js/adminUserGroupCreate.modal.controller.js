angular.module('orderCloud')
    .controller('AdminUserGroupCreateModalCtrl', AdminUserGroupCreateModalController)
;

function AdminUserGroupCreateModalController($stateParams, $uibModalInstance, $exceptionHandler, OrderCloud) {
    var vm = this;

    vm.submit = function() {
        vm.loading = OrderCloud.AdminUserGroups.Create(vm.userGroup, $stateParams.buyerid)
            .then(function(data) {
                $uibModalInstance.close(data);
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    vm.cancel = function() {
        $uibModalInstance.dismiss();
    }
}