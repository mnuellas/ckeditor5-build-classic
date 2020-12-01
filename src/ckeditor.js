/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

// The editor creator to use.
import ClassicEditorBase from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import DecoupledEditorBase from '@ckeditor/ckeditor5-editor-decoupled/src/decouplededitor';

import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import UploadAdapter from '@ckeditor/ckeditor5-adapter-ckfinder/src/uploadadapter';
import Autoformat from '@ckeditor/ckeditor5-autoformat/src/autoformat';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough';
import Subscript from '@ckeditor/ckeditor5-basic-styles/src/subscript';
import Superscript from '@ckeditor/ckeditor5-basic-styles/src/superscript';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Indent from '@ckeditor/ckeditor5-indent/src/indent';
import List from '@ckeditor/ckeditor5-list/src/list';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import Highlight from '@ckeditor/ckeditor5-highlight/src/highlight';
import TodoList from '@ckeditor/ckeditor5-list/src/todolist';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { toWidget, viewToModelPositionOutsideModelElement } from '@ckeditor/ckeditor5-widget/src/utils';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import Command from '@ckeditor/ckeditor5-core/src/command';

import { addListToDropdown, createDropdown } from '@ckeditor/ckeditor5-ui/src/dropdown/utils';
import Collection from '@ckeditor/ckeditor5-utils/src/collection';
import Model from '@ckeditor/ckeditor5-ui/src/model';

class PlaceholderFields extends Plugin {
    static get requires() {
        return [ PlaceholderFieldsEditing, PlaceholderFieldsUI ];
    }
}

class PlaceholderFieldsCommand extends Command {
    execute( { value } ) {
        const editor = this.editor;

        editor.model.change( writer => {
            // Create a <placeholder> elment with the "name" attribute...
            const placeholder = writer.createElement( 'placeholder', { name: value } );

            // ... and insert it into the document.
            editor.model.insertContent( placeholder );

            // Put the selection on the inserted element.
            writer.setSelection( placeholder, 'on' );
        } );
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;

        const isAllowed = model.schema.checkChild( selection.focus.parent, 'placeholder' );

        this.isEnabled = isAllowed;
    }
}

class PlaceholderFieldsUI extends Plugin {
    init() {
        const editor = this.editor;
        const t = editor.t;
        const placeholderNames = editor.config.get( 'placeholderConfig.types' );

        // The "placeholder" dropdown must be registered among the UI components of the editor
        // to be displayed in the toolbar.
        editor.ui.componentFactory.add( 'placeholder', locale => {
            const dropdownView = createDropdown( locale );

            // Populate the list in the dropdown with items.
            addListToDropdown( dropdownView, getDropdownItemsDefinitions( placeholderNames ) );

            dropdownView.buttonView.set( {
                // The t() function helps localize the editor. All strings enclosed in t() can be
                // translated and change when the language of the editor changes.
                label: editor.config.get( 'placeholderConfig.label' ),
                tooltip: true,
                withText: true
            } );

            // Disable the placeholder button when the command is disabled.
            const command = editor.commands.get( 'placeholder' );
            dropdownView.bind( 'isEnabled' ).to( command );

            // Execute the command when the dropdown item is clicked (executed).
            this.listenTo( dropdownView, 'execute', evt => {
                editor.execute( 'placeholder', { value: evt.source.commandParam } );
                editor.editing.view.focus();
            } );

            return dropdownView;
        } );
    }
}

function getDropdownItemsDefinitions( placeholderNames ) {
    const itemDefinitions = new Collection();

    for ( const name of placeholderNames ) {
        const definition = {
            type: 'button',
            model: new Model( {
                commandParam: name,
                label: name,
                withText: true
            } )
        };

        // Add the item definition to the collection.
        itemDefinitions.add( definition );
    }

    return itemDefinitions;
}

class PlaceholderFieldsEditing extends Plugin {
    static get requires() {
        return [ Widget ];
    }

    init() {

        this._defineSchema();
        this._defineConverters();

        this.editor.commands.add( 'placeholder', new PlaceholderFieldsCommand( this.editor ) );

        this.editor.editing.mapper.on(
            'viewToModelPosition',
            viewToModelPositionOutsideModelElement( this.editor.model, viewElement => viewElement.hasClass( 'placeholder' ) )
        );
        this.editor.config.define( 'placeholderConfig', {
			types: [ 'firstname', 'lastname', 'link_RDV', 'site', 'service_line', 'rank', 'asset_tag', 'date', 'day_of_the_week' ],
			label: "Available fields"
        } );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'placeholder', {
            // Allow wherever text is allowed:
            allowWhere: '$text',

            // The placeholder will act as an inline node:
            isInline: true,

            // The inline widget is self-contained so it cannot be split by the caret and it can be selected:
            isObject: true,

            // The placeholder can have many types, like date, name, surname, etc:
            allowAttributes: [ 'name' ]
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: 'span',
                classes: [ 'placeholder' ]
            },
            model: ( viewElement, modelWriter ) => {
                // Extract the "name" from "{name}".
                const name = viewElement.getChild( 0 ).data.slice(1);

                return modelWriter.createElement( 'placeholder', { name } );
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: 'placeholder',
            view: ( modelItem, viewWriter ) => {
                const widgetElement = createPlaceholderView( modelItem, viewWriter );

                // Enable widget handling on a placeholder element inside the editing view.
                return toWidget( widgetElement, viewWriter );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: 'placeholder',
            view: createPlaceholderView
        } );

        // Helper method for both downcast converters.
        function createPlaceholderView( modelItem, viewWriter ) {
            const name = modelItem.getAttribute( 'name' );

            const placeholderView = viewWriter.createContainerElement( 'span', {
                class: 'placeholder'
            } );

            // Insert the placeholder name (as a text).
            const innerText = viewWriter.createText( '#' + name );
            viewWriter.insert( viewWriter.createPositionAt( placeholderView, 0 ), innerText );

            return placeholderView;
        }
    }
}

class ClassicEditor extends ClassicEditorBase {}
class DecoupledEditor extends DecoupledEditorBase {}
// Plugins to include in the build.
const plugins = [
	Essentials,
	UploadAdapter,
	Autoformat,
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Subscript,
	Superscript,
	BlockQuote,
	Heading,
	Indent,
	List,
	Paragraph,
	PasteFromOffice,
	Alignment,
	Highlight,
	TodoList,
	Table,
	TableToolbar,
	PlaceholderFields
];
ClassicEditor.builtinPlugins = plugins;
DecoupledEditor.builtinPlugins = plugins;
// Editor configuration.
const config = {
	highlight: {
		options: [
			{
				model: 'greenMarker',
				class: 'marker-green',
				title: 'Green marker',
				color: '#76ed72',
				type: 'marker'
			},
			{
				model: 'redMarker',
				class: 'marker-red',
				title: 'Red marker',
				color: '#e33939',
				type: 'marker'
			},
			{
				model: 'blueMarker',
				class: 'marker-blue',
				title: 'Blue marker',
				color: 'var(--ck-highlight-marker-blue)',
				type: 'marker'
			},
			{
				model: 'pinkMarker',
				class: 'marker-pink',
				title: 'Pink marker',
				color: 'var(--ck-highlight-marker-pink)',
				type: 'marker'
			},
			{
				model: 'yellowMarker',
				class: 'marker-yellow',
				title: 'Yellow marker',
				color: 'var(--ck-highlight-marker-yellow)',
				type: 'marker'
			},
			{
				model: 'purpleMarker',
				class: 'marker-purple',
				title: 'Purple marker',
				color: '#cc26ff',
				type: 'marker'
			},
			{
				model: 'orangeMarker',
				class: 'marker-orange',
				title: 'Orange marker',
				color: '#ff8f26',
				type: 'marker'
			},
			{
				model: 'redPen',
				class: 'pen-red',
				title: 'Red pen',
				color: 'var(--ck-highlight-pen-red)',
				type: 'pen'
			}
		]
	},
	toolbar: {
		items: [
			'heading',
			'|',
			'bold',
			'italic',
			'strikethrough',
			'underline',
			'subscript',
			'superscript',
			'|',
			'bulletedList',
			'numberedList',
			'todoList',
			'|',
			'highlight',
			'removeHighlight',
			'|',
			'indent',
			'outdent',
			'|',
			'blockQuote',
			'alignment',
			'|',
			'undo',
			'redo',
			'placeholder'
		]
	},
	placeholderConfig: {
		types: [ 'firstname', 'lastname', 'link_RDV', 'site', 'service_line', 'rank', 'asset_tag', 'date', 'day_of_the_week' ],
		label: 'Available fields'
	},
	// This value must be kept in sync with the language defined in webpack.config.js.
	language: 'en'
};
ClassicEditor.defaultConfig = config;
DecoupledEditor.defaultConfig = config;

export default {
	ClassicEditor, DecoupledEditor
}
