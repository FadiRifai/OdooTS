# -*- coding: utf-8 -*-
{
    'name': "UAE Smart Card Reader",

    'summary': """
        Read all the information from the Smart card in a single click with ability to search using a specific field. Supports PACI Kuwait,UAE ID Card""",
        
    'description': """
        Enables reading all information from the Smart card in a single click. It can read into any Odoo model and not limited to the “Contact”. Supports UAE ID Card, PACI Kuwait.
    """,

    'author': "Azkatech",
    'website': "http://www.azka.tech",

    'category': 'Tool',
    'version': '15.0.0.0.1',
    
    "license": "AGPL-3",
    "support": "support+apps@azka.tech ",
    
    "price": 59,
    "currency": "USD",

    'depends': ['base'],

    'data': [
        'security/ir.model.access.csv',
        'data/paci_kuwait.xml',
        'data/icp_uae.xml',
        'views/views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'azk_card_reader/static/src/js/azkatech_card_reader.js',
           
        ],
        
       
    },
    
    'application': False, 
    'images': ['static/description/banner.png'],
}
