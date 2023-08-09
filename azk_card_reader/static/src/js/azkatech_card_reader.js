odoo.define('azkatech.card_reader', function (require) {
"use strict";
	
	var core = require('web.core');
	var rpc = require('web.rpc');
	var Class = require('web.Class');
	var FormController = require('web.FormController');
	var ListController = require('web.ListController');
	var KanbanController = require('web.KanbanController');
	var AbstractController = require('web.AbstractController');
	var Dialog = require('web.Dialog');
	var ViewDialogs = require('web.view_dialogs');
	
	// for translation
	var _t = core._t;
	
	var modalData = null;
	
	// =============================== GENERAL FUNCTIONS =================================
	function _waitToCreateCardButtons(selector) {
		/* wait form element in document to be created 
		 * @param selector: element to be waited for
		 * */
	    return new Promise(resolve => {
	        if (document.querySelector(selector)) {
	            return resolve(document.querySelector(selector));
	        }

	        const observer = new MutationObserver(mutations => {
	            if (document.querySelector(selector)) {
	                resolve(document.querySelector(selector));
	                observer.disconnect();
	            }
	        });

	        observer.observe(document.body, {
	            childList: true,
	            subtree: true
	        });
	    });
	};
	// ===================================================================================
	
	// handle pop up of models
	Dialog.include({
		_setButtonsTo: async function($target, buttons) {
			var self = this;
    		self._super.apply(self, arguments);
    		
    		if(!this.res_model) {
    			return;
    		}
    		
    		console.log('FormViewDialog Modal data:');
    		console.log(this);
    		
    		modalData = this;
    		
    		await _waitToCreateCardButtons('.modal');
    		
    		if(!this.viewController) {
	    		var cardReader = new CardReader();
	    		cardReader.getMappingsAndCreateButtons($('.modal-footer'), {});
    		}
    		
    		$('.modal').on('click', '[data-dismiss=modal]', function() {
				modalData = null;
				console.log('Modal was dismissed and modalData was reset.')
			});
		},
	});
	
	ViewDialogs.FormViewDialog.include({ 
		close: function () {
			var self = this;
    		self._super.apply(self, arguments);
    		
    		modalData = null;
    		
    		console.log('Modal was closed and modalData was reset.')
	    },
	});
	
	ViewDialogs.SelectCreateDialog.include({
		close: function () {
			var self = this;
    		self._super.apply(self, arguments);
    		
    		modalData = null;
    		
    		console.log('Modal was closed and modalData was reset.')
	    },
	});
	
	// trim the value when searching in list/kanban
	AbstractController.prototype._onSearch = function(searchQuery) {
		$.each(searchQuery['domain'], function(key, val) {
			if(Array.isArray(val) && typeof val[2] === 'string') { // get every array which will be a query and make sure to trim the value the user is searching for
				val[2] = val[2].trim();
			}
		});
		this.reload(_.extend({ offset: 0, groupsOffset: 0 }, searchQuery));
	};
	
	FormController.include({
		// will be called to render the buttons for every model
    	renderButtons: function () {
    		var self = this;
    		self._super.apply(self, arguments); 
    		
            if (self.$buttons) {
            	var cardReader = new CardReader();
            	var state = self.model.get(self.handle, {raw: true});
            	
            	cardReader.getMappingsAndCreateButtons(self.$buttons, state);
            }
        },
        
        updateButtons: async function() {
        	var self = this;
    		self._super.apply(self, arguments);
    		
    		await _waitToCreateCardButtons('.azk-card-form-buttons');
    		
    		if(self.mode == 'edit') {
    			$('.azk-card-form-buttons').removeClass('d-none');
    		} else {
    			$('.azk-card-form-buttons').addClass('d-none');
    		}
        }
    });
	
	ListController.include({
		// will be called to render the buttons for every model
    	renderButtons: function () {
    		var self = this;
    		self._super.apply(self, arguments); 
    		
            if (self.$buttons) {
            	var cardReader = new CardReader();
            	var state = self.model.get(self.handle, {raw: true});
            	cardReader.getMappingsAndCreateButtons(self.$buttons, state);
            }
        },
    });
	
	KanbanController.include({
		// will be called to render the buttons for every model
    	renderButtons: function () {
    		var self = this;
    		self._super.apply(self, arguments); 
    		
            if (self.$buttons) {
            	var cardReader = new CardReader();
            	var state = self.model.get(self.handle, {raw: true});
                
            	cardReader.getMappingsAndCreateButtons(self.$buttons, state);
            }
        },
    });
	
	var CardReader = Class.extend({
		cardMappingCache: {}, // dictionary where the key is model name, and value is dictionary(1st key is url and value is url of the web server, 2nd key is mapping and value is 
		                      // dictionary where the key is card field and value is odoo field
		init: function() {
			/* constructor */
			let me = this;
			
			// make sure to attached listeners only when the window is loaded (thus the jquwry will be loaded)
			window.onload = function() {
				console.log('Card listeners Initialed on loading');
				
				// sync card data btn click action
				$('body').on('click', 'button[name=sync_card_data_btn]', function() {
					let urlParams = new URLSearchParams(window.location.href);
					let model = urlParams.get('model');
					
					// in case a modal was opened
					if(modalData != null) {
						model = modalData.res_model;
					}
					
					me._readCard(me.cardMappingCache[model]['url'], me.cardMappingCache[model]['mapping']);
				});
				
				$('body').on('click', 'button[name=search_card_data_btn]', function() {
					let urlParams = new URLSearchParams(window.location.href);
					let model = urlParams.get('model');
					
					// in case a modal was opened
					if(modalData != null) {
						model = modalData.res_model;
					}
					me._readCardToSearch(me.cardMappingCache[model]['url'], {'form_search_field': me.cardMappingCache[model]['form_search_field'], 
							 													 'form_search_card': me.cardMappingCache[model]['form_search_card'] })
				});
			}
		},
		
		_readCard: function(card_reader_url, mapped_card_to_odoo) {
			/* call the web server to get the fields read from  card
			 * @param card_reader_url: url to be called to read from  card
			 * @param mapped_card_to_odoo: dictionary, key --> card field value --> odoo field
			 * */
			let card_url_full_path = `${card_reader_url}/azkatech/card`,
				me = this;
			
			$.ajax({
			    url:  `${card_reader_url}/azkatech/card`,
				type: 'Get',
				dataType: "json",
                crossDomain: true,
                format: "json",

				  }).done(function(data) {
					console.log(`Received data from reader on url: ${card_url_full_path}`)
				    console.log(data);
				    
					let mapped_card_values = {}, // key is Odoo field and value is the value read from card
						payload = data['payload']; 
					
					// check if the card field in the model mapping is found in the fields read from the card
					// if so, then add to the dictionary: key --> model field value --> card field value
                   
					$.each(payload, function(card_field, card_value) {
						if(card_field in mapped_card_to_odoo['mapping']) {
							mapped_card_values[mapped_card_to_odoo['mapping'][card_field]] = card_value;
						}
					});
					
					console.log('Mapped from card to odoo:')
					console.log(mapped_card_values);
					
					me._fillCardData(mapped_card_values);
			    
			  }).fail(function(xhr, status, error) {
				   console.log(`Could not call the url: ${card_url_full_path}`);
				  console.log(status);
				  Dialog.alert(me, _t("Could not read  card."), {});
			});
		},
		
		_readCardToSearch: function(card_reader_url, formSearch) {
			/* call the web server to get the fields read from  card
			 * @param card_reader_url: url to be called to read from card card
			 * @param formSearch: dictionary, key --> form_search_field/form_search_card value --> odoo field
			 * */
			
			let card_url_full_path = `${card_reader_url}/azkatech/card`,
				me = this;
			
			$.get(card_url_full_path, {}, function(data) {
				console.log(`Received data from reader on url: ${card_url_full_path}`);
			    console.log(data);
				
				let cardFieldValue = data['payload'][formSearch['form_search_card']], // get the card field value
					el = $('[name='+formSearch['form_search_field']+']'); // get the element in the form to fill the above value with
					
				if(el.find('input').length) {
					el = el.find('input');
				}
				
				console.log(`Search on element "${formSearch['form_search_field']}" using the card field "${formSearch['form_search_card']}" of value "${cardFieldValue}"`);
				el.val(cardFieldValue).trigger('change').trigger('keydown');
			}).fail(function() {
				  console.log(`Could not call the url: ${card_url_full_path}`);
				  
				  Dialog.alert(me, _t("Could not read  card."), {});
			});
		},
		
		getMappingsAndCreateButtons: function(el, state) {
			/* get the mappings of the current model
			 * @param el: element to append the card buttons to
			 * @param state: dict which contains the current model and view type
			 * */
			
			let me = this;
			
			let model = state.model;
			
			if(model in me.cardMappingCache) {
				console.log(`Model ${model} was already synced and cached. Retrieve data from cache: `)
				console.log(me.cardMappingCache[model])
				
				if(me.cardMappingCache[model]['is_mapped']) {
					me._createCardButtons(el, state);
				}
				
			} else {
				me._loadCache(function(){me._createCardButtons(el, state);}, state);
			}
		},
		
		_createCardButtons: function(el, state) {
			let me = this,
			model = state.model, view_type = state.viewType,
			is_creating = !(typeof state['ref'] === 'number');	
			
			if(modalData != null) {
				model = modalData.res_model;
				view_type = modalData.options.initial_view || 'form';
				
				if(modalData.viewController) {
					view_type = modalData.viewController.viewType;
				}
			}
			
			if(me.cardMappingCache[model]['is_mapped']) {
				console.log(`Model ${model} is mapped, will create card buttons...`);
				
				// append the button if the user has a list search field and has mappings
				if(view_type == 'list' && me.cardMappingCache[model]['list_search_field'].length && Object.keys(me.cardMappingCache[model]['mapping']['mapping']).length) {
					el.append(`
						<button name="sync_card_data_btn" class="btn btn-primary oe_button_sync_card_data" type="button" title="Search by card field">`+_t("Search Card")+`</button>
					`);
					
					// append the button if the user has a kanban search field and has mappings
				} else if(view_type == 'kanban' && me.cardMappingCache[model]['kanban_search_field'].length && Object.keys(me.cardMappingCache[model]['mapping']['mapping']).length) {
					el.append(`
							<button name="sync_card_data_btn" class="btn btn-primary oe_button_sync_card_data" type="button" title=`+_t("Search by card field")+`>`+_t("Search Card")+`</button>
						`);
				} else if(view_type == 'form') {
					if(Object.keys(me.cardMappingCache[model]['mapping']['mapping']).length) { // append the button if the user has mapped fields to the current model
						el.append(`
							<div class="azk-card-form-buttons mt-2 d-none">
								<button name="sync_card_data_btn" class="btn btn-primary oe_button_sync_card_data" type="button" title=`+_t("Read card fields from card reader")+`>`+_t("Read Card")+`</button>
							</div>
						`);
					}
					
					if(me.cardMappingCache[model]['form_search_card'].length) { // check if the user mapped a card field to a field in the form to search in, if so then append the button
						if(el.find('div.azk-card-form-buttons').length) {
							el.find('div.azk-card-form-buttons').append(`
								<button name="search_card_data_btn" class="btn btn-primary oe_button_search_card_data" type="button" title=`+_t("Search by card field")+`>`+_t("Search Card")+`</button>
							`);
						} else {
							el.append(`
								<div class="azk-card-form-buttons mt-2 d-none">
									<button name="search_card_data_btn" class="btn btn-primary oe_button_search_card_data" type="button" title=`+_t("Search by card field")+`>`+_t("Search Card")+`</button>
								</div>
							`);
						}
					}
				}
				
				if(is_creating) {
					el.find('.azk-card-form-buttons').removeClass('d-none');
				}
			}
			console.log(`Created Card buttons for view: ${view_type} and element: ${el} and model: ${model}`);
		},
		
		_loadCache:function(onSuccess, state) {
			/* get the mappings of the current model
			 * @param onSuccess: function to be executed when finishing the call
			 * */
			let me = this;

			let model = state.model;
			let view_type = state.viewType;	
			
			// in case a modal was opened
			if(modalData != null) {
				model = modalData.res_model;
				view_type = modalData.options.initial_view;
				
				if(modalData.viewController) {
					view_type = modalData.viewController.viewType;
				}
			}
			
			console.log(`Loading cache for ${window.location.href} with model:${model} and view: ${view_type}`);
			
			rpc.query({
	            model: 'azk.card.model.mapping',
	            method: 'get_fields_mapping',
	            args: [model]
	        }).then(function (modelMapping) {
	        	console.log(`Retrieved mapped fields for ${model} on view ${view_type} `)
	        	console.log(modelMapping); 
	        	
	        	//save the mapping locally
	        	me._saveMapping(model, modelMapping)
	            onSuccess();
            }); 	
		},
		
		_saveMapping: function(model_name, modelMapping) {
			/* save the mapping in the cache
			 * @param model_name: model name to be used as key in the cache dictionary
			 * @param  modelMapping: dictionary, key --> card field value --> odoo field
			 * */
			let me = this;
			
			me.cardMappingCache[model_name] = {};
			me.cardMappingCache[model_name]['url'] = modelMapping.url;
			me.cardMappingCache[model_name]['mapping'] = modelMapping;
			me.cardMappingCache[model_name]['kanban_search_field'] = modelMapping.kanban_search_field;
			me.cardMappingCache[model_name]['list_search_field'] = modelMapping.list_search_field;
			me.cardMappingCache[model_name]['form_search_field'] = modelMapping.form_search_field;
			me.cardMappingCache[model_name]['form_search_card'] = modelMapping.form_search_card;
			me.cardMappingCache[model_name]['is_mapped'] = modelMapping.is_mapped;
			
			console.log(`Saved the mapping of the model: ${model_name} with mapping: `);
			console.log(modelMapping);
		},
		
		_fillCardData: function(data) {
			/* after retrieving the data from the web server this method will be called to
			 * show the data retrieved in the form or tree
			 * @data: dictionary, key --> model_field value --> value read from the card
			 * */
			
			let me = this;
			let urlParams = new URLSearchParams(window.location.href);
			let model = urlParams.get('model');
			let view_type = urlParams.get('view_type');			
			
			// pop up is opened
			if(modalData != null) {
				model = modalData.res_model;
				view_type = modalData.options.initial_view || 'form';
				
				if(modalData.viewController) {
					view_type = modalData.viewController.viewType;
				}
			}
			
			if(view_type == 'form') {
				$.each(data, function(key, val) {
					let el = $('[name='+key+']');
					// check if el is a div, if so then get the input of it
					// this will be in the case we have a selection field, or input inside a div...
					if( el.find('input').length ) {
						el = el.find('input');
					}
					// logic for card holder image
					if(el && el.length > 2){
						$.each(el, function(index, value){
							 if(value.type=='file' && val != ''){
								let imag_path = 'data:image/png;base64,' + val;
								fetch(imag_path)
								  .then(res => res.blob())
								  .then(blob => {
								    const imagFile = new File([blob], "Card Photo",{ type: "image/png" });
									const dt = new DataTransfer();
									dt.items.add(imagFile);
									value.files = dt.files;
									$(value).trigger("change");
									
								 })
							}
						})
					}else{
						el.val(val).trigger('change').trigger('keydown'); // make sure to trigger change in order for the values to be picked when saving the form
																	  // make sure to trigger keydown in order for the values in the selections to be shown
					}
				});
				
			} else if(view_type == 'list' || view_type == 'kanban' || view_type == 'search') { // it is "search" in case of popup
				let modelFieldValue = data[me.cardMappingCache[model][`${view_type}_search_field`]];
				$('[role=searchbox]').val(modelFieldValue);
				
				console.log(`Search in "${view_type}" using the field "${me.cardMappingCache[model][`${view_type}_search_field`]}" of value "${modelFieldValue}"`);
			}
		},
	}) ;
	return new CardReader();
});

