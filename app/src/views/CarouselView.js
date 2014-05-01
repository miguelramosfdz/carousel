/*globals define*/
define(function(require, exports, module) {
    var View = require('famous/core/View');
    var Surface = require('famous/core/Surface');
    var Transform = require('famous/core/Transform');
    var Utility = require('famous/utilities/Utility');
    var StateModifier = require('famous/modifiers/StateModifier');
    var ScrollView = require('famous/views/ScrollView');
    var ScrollItemView = require('./ScrollItemView');
    var Group = require('famous/core/Group');
    var OptionsManager = require('famous/core/OptionsManager');

    /*
     * @name CarouselView
     * @constructor
     * @description
     */

    function CarouselView (options) {
        ScrollView.apply(this, arguments);
        this.setOptions(CarouselView.DEFAULT_OPTIONS);
        this.setOptions(options);

        this._scroller.group = new Group();
        this._scroller.group.add({render: _customInnerRender.bind(this)});

        // ADD EVENT LISTENERS
        // this._eventInput.on('update', _customHandleMove.bind(this._scroller));
        this._eventInput.on('end', _endVelocity.bind(this));
    }

    CarouselView.prototype = Object.create(ScrollView.prototype);
    CarouselView.prototype.constructor = CarouselView;
    // CarouselView.prototype.outputFrom  = undefined;

    CarouselView.DEFAULT_OPTIONS = {
        direction: Utility.Direction.X,
        paginated: false,
        startFade: 1,
        endFade: 1,
        depth: 1,
        rotateRadian: Math.PI / 2,
        rotateOrigin: [0.5, 0.5],
        maxVelocity: 3000
    };

    function _output(node, offset, target) {
        var direction = this.options.direction;
        var depth = this.options.depth;
        var origin = this.options.rotateOrigin;
        var size = node.getSize ? node.getSize() : this._contextSize;
        var position = offset + size[direction] / 2 - this._positionGetter();

        // TRANSFORM FUNCTIONS
        var translateXY = _translateXY.call(this, offset);
        var translateZ = _translateZ.call(this, depth);
        var opacity = _customFade.call(this, position);

        var transform = Transform.multiply(translateXY, translateZ);

        target.push({
            size: size,
            opacity: opacity,
            target: {
                origin: origin, 
                target: {
                    transform: transform,
                    target: node.render()
                }
            }
        });

        return size[direction];
    }

    // function _output(node, offset, target) {
    //     var direction = this.options.direction;
    //     var size = node.getSize ? node.getSize() : this._contextSize;
    //     var position = offset + size[direction] / 2 - this._positionGetter();

    //     // TRANSFORM FUNCTIONS
    //     var translateScale = _translateAndScale.call(this, position, offset);
    //     var opacity = _customFade.call(this, position, offset);
    //     var rotate = (this.options.rotateRadian === null) ? Transform.identity : _rotateY.call(this, position, offset);

    //     var xScale = translateScale[0];
    //     var yScale = translateScale[5];

    //     var transform = Transform.multiply4x4(translateScale, rotate);

    //     target.push({transform: transform, opacity: opacity, target: node.render()});
    //     var scale = direction === Utility.Direction.X ? xScale : yScale;

    //     return size[direction] * scale;
    // }

    function _scalingFactor (screenWidth, startScale, endScale, currentPosition) {
        // currentPosition will be along x or y axis
        var midpoint = screenWidth / 2;
        if (currentPosition <= midpoint && currentPosition >= 0) {
            // from 0 to midpoint
            return ((endScale - startScale) / midpoint) * currentPosition + startScale;
        } else if (currentPosition > midpoint && currentPosition <= screenWidth){
            // from midpoint to screenWidth
            return (-(endScale - startScale) / midpoint) * currentPosition + (2 * (endScale - startScale) + startScale);
        } else {
            // when its offscreen
            return startScale;
        }
    }

    function _rotateY () {
        var screenWidth = this.options.direction === Utility.Direction.X ? window.innerWidth : window.innerHeight;
        var rotateRadian = this.options.rotateRadian;
        var velocity = this.velocity || this.options.maxVelocity;

        // var rad = -(rotateRadian * position / midpoint) + rotateRadian;
        var rad = -(rotateRadian * velocity / this.options.maxVelocity) + rotateRadian;
        return Transform.rotateY(rad);
    }

    function _translateXY (offset) {
        var direction = this.options.direction;
        var vector = [0, 0, 0];
        vector[direction] = offset;
        return Transform.translate.apply(null, vector);
    }

    function _translateZ (depth) {
        return Transform.translate.apply(null, [0, 0, depth]);
    }

    // function _translateAndScale (position, offset) {
    //     var direction = this.options.direction;
    //     var screenWidth = this.options.direction === Utility.Direction.X ? window.innerWidth : window.innerHeight;
    //     var startScale = this.options.startScale;
    //     var endScale = this.options.endScale;
    //     var startDepth = this.options.startDepth;
    //     var endDepth = this.options.endDepth;

    //     // for scaling
    //     var scaleVector = [1, 1, 1];
    //     var scaling = _scalingFactor(screenWidth, startScale, endScale, position);

    //     // for depth
    //     var depth = _scalingFactor(screenWidth, startDepth, endDepth, position);

    //     scaleVector[0] = scaling;
    //     scaleVector[1] = scaling;

    //     // for translation
    //     var vector = [0, 0, 0];
    //     vector[direction] = offset;
        
    //     // adding depth
    //     vector[2] = depth;

    //     var transform = Transform.thenMove(Transform.scale.apply(null, scaleVector), vector);
    //     return transform;
    // }

    function _customFade (position) {
        var screenWidth = this.options.direction === Utility.Direction.X ? window.innerWidth : window.innerHeight;
        var startFade = this.options.startFade;
        var endFade = this.options.endFade;
        return _scalingFactor(screenWidth, startFade, endFade, position);
    }

    // function _customHandleMove (e) {
    //     this.velocity = e.velocity;
    // }

    function _endVelocity (e) {
        var scroller = this._scroller;
        scroller.velocity = scroller.options.maxVelocity;
    }

    // COPIED OVER FROM SCROLLER
    function _customInnerRender() {
        // custom binding here
        var scroller = this._scroller;

        var size = null;
        var position = scroller._position;
        var result = [];

        scroller._onEdge = 0;

        var offset = -scroller._positionOffset;
        var clipSize = _getClipSize.call(scroller);
        var currNode = scroller._node;
        while (currNode && offset - position < clipSize + scroller.options.margin) {
            offset += _output.call(scroller, currNode, offset, result);
            currNode = currNode.getNext ? currNode.getNext() : null;
        }

        var sizeNode = scroller._node;
        var nodesSize = _sizeForDir.call(scroller, sizeNode.getSize());
        if (offset < clipSize) {
            while (sizeNode && nodesSize < clipSize) {
                sizeNode = sizeNode.getPrevious();
                if (sizeNode) nodesSize += _sizeForDir.call(scroller, sizeNode.getSize());
            }
            sizeNode = scroller._node;
            while (sizeNode && nodesSize < clipSize) {
                sizeNode = sizeNode.getNext();
                if (sizeNode) nodesSize += _sizeForDir.call(scroller, sizeNode.getSize());
            }
        }

        var edgeSize = (nodesSize !== undefined && nodesSize < clipSize) ? nodesSize : clipSize;

        if (!currNode && offset - position <= edgeSize) {
            scroller._onEdge = 1;
            scroller._eventOutput.emit('edgeHit', {
                position: offset - edgeSize
            });
        }
        else if (!scroller._node.getPrevious() && position <= 0) {
            scroller._onEdge = -1;
            scroller._eventOutput.emit('edgeHit', {
                position: 0
            });
        }

        // backwards
        currNode = (scroller._node && scroller._node.getPrevious) ? scroller._node.getPrevious() : null;
        offset = -scroller._positionOffset;
        if (currNode) {
            size = currNode.getSize ? currNode.getSize() : scroller._contextSize;
            offset -= _sizeForDir.call(scroller, size);
        }

        while (currNode && ((offset - position) > -(_getClipSize.call(scroller) + scroller.options.margin))) {
            _output.call(scroller, currNode, offset, result);
            currNode = currNode.getPrevious ? currNode.getPrevious() : null;
            if (currNode) {
                size = currNode.getSize ? currNode.getSize() : scroller._contextSize;
                offset -= _sizeForDir.call(scroller, size);
            }
        }

        _normalizeState.call(scroller);
        return result;
    }

    function _sizeForDir(size) {
        if (!size) size = this._contextSize;
        var dimension = (this.options.direction === Utility.Direction.X) ? 0 : 1;
        return (size[dimension] === undefined) ? this._contextSize[dimension] : size[dimension];
    }

    function _getClipSize() {
        if (this.options.clipSize) return this.options.clipSize;
        else return _sizeForDir.call(this, this._contextSize);
    }

    function _normalizeState() {
        var nodeSize = _sizeForDir.call(this, this._node.getSize());
        var nextNode = this._node && this._node.getNext ? this._node.getNext() : null;
        while (nextNode && this._position + this._positionOffset >= nodeSize) {
            this._positionOffset -= nodeSize;
            this._node = nextNode;
            nodeSize = _sizeForDir.call(this, this._node.getSize());
            nextNode = this._node && this._node.getNext ? this._node.getNext() : null;
        }
        var prevNode = this._node && this._node.getPrevious ? this._node.getPrevious() : null;
        while (prevNode && this._position + this._positionOffset < 0) {
            var prevNodeSize = _sizeForDir.call(this, prevNode.getSize());
            this._positionOffset += prevNodeSize;
            this._node = prevNode;
            prevNode = this._node && this._node.getPrevious ? this._node.getPrevious() : null;
        }
    }

    module.exports = CarouselView;
});