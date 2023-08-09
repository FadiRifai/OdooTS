# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import Warning


card_types = [('paci', 'PACI Kuwait'), ('uae_icp', 'UAE ID Card')]

class CardFields(models.Model):
    _name = 'azk.card.fields'
    _description = 'Card Fields'
    
    name = fields.Char('Field Label', required=True, help="Human Readable Field Name")
    card_field_name = fields.Char('Card Field Name', required=True, help="Field Name On Card")
    card_type = fields.Selection(selection=card_types, string='Card Type', required=True)

class CardReader(models.Model):
    _name = 'azk.card.reader'
    _description = 'Card Reader'

    url = fields.Char(required=True, default="http://127.0.0.1")
    port = fields.Char(required=True, default=8060)
    name = fields.Char(required=True)
    is_default = fields.Boolean(required=True)
    
class CardModel(models.Model):
    _name = 'azk.card.model'
    _description = 'Card Model'
    _rec_name = 'model_id'
    
    model_id = fields.Many2one('ir.model', ondelete='cascade', required=True, help="Model to be mapped")
    model_name = fields.Char(compute='_compute_model_name', store=True)
    card_type = fields.Selection(selection=card_types, string='Card Type', required=True)
    kanban_search_field = fields.Many2one('ir.model.fields', ondelete='cascade', help='Card Field which will used to search upon in kanban.')
    list_search_field = fields.Many2one('ir.model.fields', ondelete='cascade', help='Card Field which will be used to search upon in list.')
    form_search_card = fields.Many2one('azk.card.fields', help='UAE Card  field to read and fill in the form to search for it')
    form_search_field = fields.Many2one('ir.model.fields', ondelete='cascade')
    card_model_mapping = fields.One2many('azk.card.model.mapping', 'card_model')
    
    _sql_constraints = [('unique_model_id', 'unique(model_id)', 'You already mapped this model, if you want to change it make sure to change the already existing record.')]
    
    @api.depends('model_id')
    def _compute_model_name(self):
        for record in self:
            record.model_name = record.model_id.model
    
class ModelMapping(models.Model):
    _name = 'azk.card.model.mapping'
    _description = 'Model Mapping'
    _rec_name = 'card_field'
    
    card_field = fields.Many2one('azk.card.fields', required=True, help='Card field to be mapped')
    card_model = fields.Many2one('azk.card.model', required=True, help='Odoo model to be mapped to card field')
    card_type = fields.Selection(related='card_model.card_type')
    model_field = fields.Many2one('ir.model.fields', ondelete='cascade', required=True, help='Odoo Field which will be mapped.')
    model_id = fields.Many2one('ir.model', related='card_model.model_id')
        
    @api.model
    def get_fields_mapping(self, model_name):
        """
        To be called from the JS, given a parameter the model name and returns the mapping of the fields
        @param model_name: name of the model to get its fields mapping with card fields
        @return: dictionary where the key is the card field and the value is the Odoo field for the input model
        """
        model_mappings = self.env['azk.card.model'].search([('model_name', '=', model_name)])
        
        rt_val = {'url': 'http://localhost:8010', 'mapping': {}, 'kanban_search_field': '', 'list_search_field': '', 
                  'form_search_card': '', 'form_search_field': '', 'is_mapped': False}
        
        rt_val['mapping'] = dict(map(lambda d: (d.card_field.card_field_name, d.model_field.name), model_mappings.card_model_mapping))
        rt_val['kanban_search_field'] = model_mappings.kanban_search_field.name
        rt_val['list_search_field'] = model_mappings.list_search_field.name
        rt_val['form_search_card'] = model_mappings.form_search_card.card_field_name
        rt_val['form_search_field'] = model_mappings.form_search_field.name
        
        # check if the current model is mapped to something
        if len(rt_val['mapping']) or rt_val['kanban_search_field'] or rt_val['list_search_field'] or rt_val['form_search_card'] or rt_val['form_search_field']:
            rt_val['is_mapped'] = True
            
        return rt_val