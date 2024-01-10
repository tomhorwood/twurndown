import { repeat } from './utilities'

let rules = {};

rules.paragraph = {
    filter: 'p',

    replacement: function (content) {
        return '\n\n' + content + '\n\n'
    }
};

rules.lineBreak = { // tw5
    filter: 'br',

    replacement: function (content, node, options) {
        let parent = node.parentNode;
        switch (parent.nodeName) {
            case 'TH':
            case 'TD':
            case 'LI':
            case 'DD':
            case 'DT':
                return ' <br/> '; // we want to preserve the br tag in these cases to allow multiple lines within HTML tags
            default:
                return options.br + '\n'
        }
    }
};

rules.heading = { // tw5
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

    replacement: function (content, node, options) {
        let hLevel = Number(node.nodeName.charAt(1));
        let hClass = cleanAttribute(node.getAttribute('class'));
        if (hClass) hClass = toClassDeclarations(hClass);

        return '\n\n' + repeat('!', hLevel) + hClass + ' ' + content + '\n\n'
    }
};

rules.cite = { // tw5
    filter: function (node) {
        return (
            node.nodeName === 'CITE' &&
            node.parentNode.nodeName === 'BLOCKQUOTE'
        )
    },

    replacement: function () {
        return '';  // suppress showing citation in content
    }
};

rules.inlineBlockquote = { // tw5
    filter: function (node) {
        if (node.nodeName !== 'BLOCKQUOTE')
            return false;
        if (node.parentNode.nodeName === 'LI')
            return true;
        let currentNode = node;
        /** test if any parent is quote **/
        while (currentNode.parentNode) {
            currentNode = currentNode.parentNode
            if (currentNode.nodeName === 'BLOCKQUOTE')
                return true;
        }
        /** test if any child is quote **/
        function childIsQuote(node) {
            if (node.hasChildNodes())
                return Array.prototype.some.call(node.childNodes, function (childNode) {
                    if (childNode.nodeName === 'BLOCKQUOTE')
                        return true;
                    else
                        return childIsQuote(childNode);
                });
        }
        return childIsQuote(node);
    },

    replacement: function (content) {
        content = content.replace(/^\n+|\n+$/g, '');
        content = content.replace(/^/gm, '>');
        return '\n\n' + content + '\n\n'
    }
};

rules.multilineBlockquote = { // tw5
    filter: 'blockquote',

    replacement: function (content, node) {
        content = content.replace(/^\n+|\n+$/g, '');
        let bqClass = cleanAttribute(node.getAttribute('class'));
        if (bqClass) bqClass = toClassDeclarations(bqClass);
        let citation = Array.prototype.find.call(node.childNodes,
            childNode => childNode.nodeName === 'CITE'
        )
        citation = citation ? ' ' + citation.textContent : '';
        return '\n<<<' + bqClass + '\n' +
            content +
            '\n<<<' + citation + '\n';
    }
};

rules.dl = { // tw5
    filter: ['dl'],

    replacement: function (content, node) {
        return '\n\n' + content + '\n\n';
    }
};

rules.dtdd = { // tw5
    filter: ['dt', 'dd'],

    replacement: function (content, node) {
        console.log(content);
        content = content.trim().replace(/\n+/g, '\n')
            .replace(/^/gm, (node.nodeName === 'DT') ? '\n;' : '\n:')
            .replace(/\n+/g, '\n')
        console.log(content);
        return content;
    }
};

rules.list = {
    filter: ['ul', 'ol'],

    replacement: function (content, node) {
        let parent = node.parentNode;
        if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
            return '\n' + content
        } else {
            return '\n\n' + content + '\n\n'
        }
    }
};

rules.listItem = { // tw5
    filter: 'li',

    replacement: function (content, node, options) {
        
        let prefix = options.bulletListMarker;
        let parent = node.parentNode;
        if (parent.nodeName === 'OL') {
            prefix = options.numberListMarker;
        }
        let liClass = cleanAttribute(node.getAttribute('class'));
        if (liClass) liClass = toClassDeclarations(liClass);

        content = content
            .replace(/\n+/g, '\n') // simplify duplicated newlines
            .replace(/\n+$/, '') // remove trailing newlines
            .replace(/\n/gm, '\n' + prefix); // prefix identifier with class declaration

        let padding = (content[0] === '#' || content[0] === '*') ? '' : ' '; // Add spacing if content is not already a nested list     

        return (
            prefix + liClass + padding + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
        )
    }
};

rules.table = { // tw5
    filter: 'table',
    replacement: function (content, node, options) {
        rules.tdth.rowspan = [];	// reset rowspan after each table processing
        rules.tdth.currentx, rules.tdth.currenty = 0;

        // *** Table class ***
        let tClass = cleanAttribute(node.getAttribute('class'));
        if (tClass) tClass = '|' + tClass + "|k\n";

        content = content
            .replace(/\n+/g, '\n'); // simplify duplicated newlines

        return '\n\n' + tClass + content + '\n\n';
    }
};

rules.tr = { // tw5
    filter: ['tr', 'tbody', 'thead', 'tfoot', 'caption'],

    replacement: function (content, node, options) {

        content = content
            .replace(/^\n+/, '') // remove leading newlines
            .replace(/\n+$/, '\n') // replace trailing newlines with just a single one

        // *** row format trailer ***
        switch (node.nodeName) {
            case 'THEAD':
                content += 'h'; break;
            case 'TFOOT':
                content += 'f'; break;
            case 'CAPTION':
                content = '|' + content + '|c'; break;
        }

        return (
            content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
        )
    }
};

rules.tdth = { // tw5

    rowspan: [],	// to record merged COLUMNs across td/th declarations
    currentx: 0,
    currenty: 0,
    filter: ['td', 'th'],

    replacement: function (content, node, options) {

        content = content
            .replace(/^\n+/, '') // remove leading newlines
            .replace(/\n+$/, '') // replace trailing newlines
            .replace(/^,/, '&#44;') // replace first , characters
            .replace(/^\^/, '&#94;') // replace first ^ characters       

        content = content.replace(/(?:\r\n|\r|\n)/g, '<br/>');

        // *** format TH field with ! ***
        if (node.nodeName === 'TH') content = "!" + content;

        // *** Horizontal Alignment ***
        let align = cleanAttribute(node.getAttribute('align')).toLowerCase();
        switch (align) {
            case 'left':
                content = content + ' ';
                break;
            case 'right':
                content = ' ' + content;
                break;
            case 'center':
                content = ' ' + content + ' ';
                break;
        }

        // *** Vertical Alignment ***
        let vAlign = cleanAttribute(node.getAttribute('valign')).toLowerCase();
        switch (vAlign) {
            case 'top':
                content = '^' + content;
                break;
            case 'bottom':
                content = ',' + content;
                break;
        }

        let child = node;

        // *** Horizontal merged cells ***
        let colspan = Number(cleanAttribute(node.getAttribute('colspan')));
        if (colspan > 0) {
            colspan--;
            content = content + repeat('|<', colspan) // expand colspan to merge cells horizontally
        }

        //*** Vertical merged cells ***
        let rowspan = Number(cleanAttribute(node.getAttribute('rowspan')));
        if (rowspan > 0) {
            rowspan--;
        }
        while (this.rowspan[this.currentx] > 0) {
            content = '~|' + content;
            this.rowspan[this.currentx]--;
            this.currentx++;
        }

        for (let i = 0; i <= colspan; i++) {
            this.rowspan[this.currentx + i] = rowspan;
        }
        this.currentx += colspan;

        let parent = node.parentNode;
        if (parent.nodeName === 'TR' && parent.lastElementChild === node) {
            while (this.rowspan.length > this.currentx + 1) {
                content = content + '|~';
                this.rowspan[this.currentx + 1]--;
                this.currentx++;
            }
            // *** edge case where next line is completely empty ***
            let minRowSpan = Math.min(...this.rowspan)
            this.rowspan = this.rowspan.map((x) => x - minRowSpan);
            this.currenty++;
            this.currentx = 0;
            return '|' + content + '|'
        } else {
            this.currentx += 1;
            return '|' + content
        }
    }
};

rules.fencedCodeBlock = { // tw5
    filter: function (node, options) {
        return (
            node.nodeName === 'PRE' &&
            node.firstChild &&
            node.firstChild.nodeName === 'CODE'
        )
    },

    replacement: function (content, node, options) {
        let className = node.firstChild.getAttribute('class') || '';
        let language = (className.match(/language-(\S+)/) || [null, ''])[1];
        let code = Array.prototype.map.call(node.childNodes, function (childNode) {
            if (childNode.nodeName === 'CODE')
                return childNode.textContent;
            if (childNode.nodeName === 'BR')
                return "\n";
            return "";
        }).join("");

        let fenceChar = options.fence.charAt(0);
        let fenceSize = 3;
        let fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

        let match;
        while ((match = fenceInCodeRegex.exec(code))) {
            if (match[0].length >= fenceSize) {
                fenceSize = match[0].length + 1;
            }
        }

        let fence = repeat(fenceChar, fenceSize);

        return (
            '\n\n' + fence + language + '\n' +
            code.replace(/\n$/, '') +
            '\n' + fence + '\n\n'
        )
    }
};

rules.horizontalRule = {
    filter: 'hr',

    replacement: function (content, node, options) {
        return '\n\n' + options.hr + '\n\n'
    }
};

rules.link = { // tw5
    filter: function (node, options) {
        return (
            options.linkStyle === 'inlined' &&
            node.nodeName === 'A' &&
            node.getAttribute('href')
        )
    },

    replacement: function (content, node) {
        let href = decodeURIComponent(node.getAttribute('href'));
        let ext = 'ext';
        if (href[0] === '#') { // This is an internal link!
            ext = '';
            href = href.substring(1);
        }
        if (href === content) { // link is identical to text
            href = '';
        } else {
            href = '|' + href;
        }

        return '[' + ext + '[' + content + href + ']]';
    }
};

rules.underscore = { // tw5
    filter: ['u'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.underscoreDelimiter + content + options.underscoreDelimiter
    }
};

rules.strike = { // tw5
    filter: ['strike'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.strikeDelimiter + content + options.strikeDelimiter
    }
};

rules.sub = { // tw5
    filter: ['sub'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.subDelimiter + content + options.subDelimiter
    }
};

rules.sup = { // tw5
    filter: ['sup'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.supDelimiter + content + options.supDelimiter
    }
};

rules.emphasis = {
    filter: ['em', 'i'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.emDelimiter + content + options.emDelimiter
    }
};

rules.strong = {
    filter: ['strong', 'b'],

    replacement: function (content, node, options) {
        if (!content.trim()) return ''
        return options.strongDelimiter + content + options.strongDelimiter
    }
};

rules.code = { // tw5
    filter: function (node) {
        let hasSiblings = node.previousSibling || node.nextSibling;
        let isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;

        return node.nodeName === 'CODE' && !isCodeBlock
    },

    replacement: function (content) {
        if (!content.trim()) return ''

        let delimiter = '`';
        let leadingSpace = '';
        let trailingSpace = '';
        let matches = content.match(/`+/gm);
        if (matches) {
            if (/^`/.test(content)) leadingSpace = ' ';
            if (/`$/.test(content)) trailingSpace = ' ';
            if (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';
        }
        // Tiddlywiki only supports max 2 levels of backticks

        return delimiter + leadingSpace + content + trailingSpace + delimiter
    }
};

rules.image = { // tw5
    filter: 'img',

    replacement: function (content, node) {
        let alt = cleanAttribute(node.getAttribute('alt'));
        let src = node.getAttribute('src') || '';
        let title = cleanAttribute(node.getAttribute('title'));
        let width = cleanAttribute(node.getAttribute('width'));
        let height = cleanAttribute(node.getAttribute('height'));
        let iClass = cleanAttribute(node.getAttribute('class'));

        alt = alt ? " alt=\"" + alt + '"' : '';
        title = title ? title + '|' : '';
        width = width ? " width=" + width : "";
        height = height ? " height=" + height : "";
        iClass = iClass ? " class=\"" + iClass + "\"" : "";

        return src ? '[img' + width + height + iClass + ' [' + title + src + ']]' : ''
    }
};

const cleanAttribute = (attribute) => attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';

export default rules
