angular.module('orderCloud')
    .controller('UserGroupMembersCtrl', UserGroupMembersController)
;

function UserGroupMembersController($q, $filter, $state, $stateParams, $uibModal, toastr, ocConfirm, $ocMedia, OrderCloud, OrderCloudParameters, UserMembers, SelectedUserGroup, Parameters ) {
    var vm = this;
    vm.list = UserMembers;
    vm.parameters = Parameters;
    vm.sortSelection = Parameters.sortBy ? (Parameters.sortBy.indexOf('!') == 0 ? Parameters.sortBy.split('!')[1] : Parameters.sortBy) : null;

    //Check if filters are applied
    vm.filtersApplied = vm.parameters.filters || vm.parameters.from || vm.parameters.to || ($ocMedia('max-width:767px') && vm.sortSelection); //Sort by is a filter on mobile devices
    vm.showFilters = vm.filtersApplied;

    //Check if search was used
    vm.searchResults = Parameters.search && Parameters.search.length > 0;

    //Reload the state with new parameters
    vm.filter = function(resetPage) {
        $state.go('userGroup.members', OrderCloudParameters.Create(vm.parameters, resetPage));
    };

    //Reload the state with new search parameter & reset the page
    vm.search = function() {
        $state.go('.', OrderCloudParameters.Create(vm.parameters, true), {notify:false}); //don't trigger $stateChangeStart/Success, this is just so the URL will update with the search
        vm.searchLoading = OrderCloud.Users.List(vm.parameters.usergroupid, vm.parameters.search, 1, vm.parameters.pageSize || 12, vm.parameters.searchOn, vm.parameters.sortBy, vm.parameters.filters, vm.parameters.buyerid)
            .then(function(data) {
                vm.list = data;
                vm.searchResults = vm.parameters.search.length > 0;
            })
    };

    //Clear the search parameter, reload the state & reset the page
    vm.clearSearch = function() {
        vm.parameters.search = null;
        vm.filter(true);
    };

    //Clear relevant filters, reload the state & reset the page
    vm.clearFilters = function() {
        vm.parameters.filters = null;
        vm.parameters.from = null;
        vm.parameters.to = null;
        $ocMedia('max-width:767px') ? vm.parameters.sortBy = null : angular.noop(); //Clear out sort by on mobile devices
        vm.filter(true);
    };

    //Conditionally set, reverse, remove the sortBy parameter & reload the state
    vm.updateSort = function(value) {
        value ? angular.noop() : value = vm.sortSelection;
        switch(vm.parameters.sortBy) {
            case value:
                vm.parameters.sortBy = '!' + value;
                break;
            case '!' + value:
                vm.parameters.sortBy = null;
                break;
            default:
                vm.parameters.sortBy = value;
        }
        vm.filter(false);
    };

    //Used on mobile devices
    vm.reverseSort = function() {
        Parameters.sortBy.indexOf('!') == 0 ? vm.parameters.sortBy = Parameters.sortBy.split('!')[1] : vm.parameters.sortBy = '!' + Parameters.sortBy;
        vm.filter(false);
    };

    //Reload the state with the incremented page parameter
    vm.pageChanged = function() {
        $state.go('.', {page:vm.list.Meta.Page});
    };

    //Load the next page of results with all of the same parameters
    vm.loadMore = function() {
        return OrderCloud.Users.List(Parameters.userGroupID, Parameters.search, vm.list.Meta.Page + 1, Parameters.pageSize || vm.list.Meta.PageSize, Parameters.searchOn, Parameters.sortBy, Parameters.filters, Parameters.buyerid)
            .then(function(data) {
                vm.list.Items = vm.list.Items.concat(data.Items);
                vm.list.Meta = data.Meta;
            });
    };

    vm.addUser = function(group) {
        $uibModal.open({
            templateUrl: 'userGroups/members/templates/userGroupMembersCreate.modal.html',
            controller: 'UserGroupMembersCreateModalCtrl',
            controllerAs: 'userGroupMembersCreateModal',
            resolve: {
                SelectedUserGroup: function() {
                    return group;
                },
                SelectedBuyerID: function() {
                    return $stateParams.buyerid;
                },
                UsersList: function() {
                    return OrderCloud.Users.List(null, null, null, null, null, null, null, $stateParams.buyerid);
                }
            }
        }).result
            .then(function(newMembers) {
                vm.list.Items = vm.list.Items.concat(newMembers);
                vm.list.Meta.TotalCount = vm.list.Meta.TotalCount + newMembers.length;
                vm.list.Meta.ItemRange[1] = vm.list.Meta.ItemRange[1] + newMembers.length;
                toastr.success(newMembers.length + (newMembers.length == 1 ? ' was ' : ' were ') + 'added to ' + SelectedUserGroup.Name);
            })
    };

    vm.allItemsSelected = false;
    vm.selectAllItems = function() {
        _.map(vm.list.Items, function(i) { i.selected = vm.allItemsSelected });
        vm.selectedCount = vm.allItemsSelected ? vm.list.Items.length : 0;
    };

    vm.selectItem = function(scope) {
        if (!scope.user.selected) vm.allItemsSelected = false;
        vm.selectedCount = $filter('filter')(vm.list.Items, {'selected':true}).length;
    };

    vm.removeSelected = function() {
        ocConfirm.Confirm({
                'message': 'Are you sure you want to remove the selected users from this group?',
                'confirmText': 'Remove ' + vm.selectedCount + (vm.selectedCount == 1 ? ' user' : ' users')
            })
            .then(function() {
                return run();
            });

        function run() {
            var df = $q.defer(),
                successCount = 0,
                removeQueue = [];

            angular.forEach(vm.list.Items, function(item) {
                if (item.selected) {
                    removeQueue.push((function() {
                        var d = $q.defer();

                        OrderCloud.UserGroups.DeleteUserAssignment(SelectedUserGroup.ID, item.ID, $stateParams.buyerid)
                            .then(function() {
                                successCount++;
                                vm.list.Items = _.without(vm.list.Items, item);
                                vm.list.Meta.TotalCount--;
                                vm.list.Meta.ItemRange[1]--;
                                d.resolve();
                            })
                            .catch(function() {
                                d.resolve();
                            });

                        return d.promise;
                    })())
                }
            });

            vm.searchLoading = $q.all(removeQueue)
                .then(function() {
                    toastr.success(successCount + (successCount == 1 ? ' user was removed' : ' users were removed'), 'Success!');
                    vm.selectedCount = 0;
                    vm.allItemsSelected = false;
                    if (!vm.list.Items.length) vm.filter(true);
                    df.resolve();
                });

            return df.promise;
        }
    }
}