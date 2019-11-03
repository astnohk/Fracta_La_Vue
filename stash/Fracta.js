// The code written in BSD/KNF indent style
"use strict";

class FractaLaVue {
	constructor(windowSystemRoot, rootWindow) {
		this.SysRoot = windowSystemRoot;
		this.rootWindow = rootWindow;
		this.rootWindow.style.overflow = "hidden";
		this.rootWindow.rootInstance = this;
		this.rootWindowStyle = window.getComputedStyle(this.rootWindow);
		this.loopEnded = true;

		this.canvasWidth = 800;
		this.canvasHeight = 800;

		this.fractalMap = [];
		this.fractalTimeMax = 10000;
		this.fractalTimeCurrent = 0;

		this.touchCounter = 0;
		this.touchCounting = false;

		this.overwritingButton = null;
		this.view3DButton = null;
		this.overwriting = false;
		this.view3D = 0;
		this.eyesDistance = 30;

		this.timeClock = null;

		this.bitmap = null;
		this.canvas = null;
		this.context = null;
		this.viewScale = Math.max(this.canvasWidth, this.canvasHeight) / 2.0;

		this.camera = {
			pos: {x: -0.5, y: 0.0, z: 0.0},
			view: {
				X: {x: 1.0, y: 0.0, z: 0.0},
				Y: {x: 0.0, y: -1.0, z: 0.0},
				Z: {x: 0.0, y: 0.0, z: -1.0}
			},
			F: 30
		};
		this.colormapQuantize = 200;
		this.colormap = {current: [], normal: new Array(this.colormapQuantize), bluesea: new Array(this.colormapQuantize)};

		this.prev_mouse = {x: 0, y: 0};
		this.prev_touches = [];

		// Initialize
		this.init();
	}

// ----- Initialize -----
	init()
	{
		// Make colormap
		this.makeColormap();
		this.colormap.current = this.colormap.normal;
		// Initialize canvas
		this.prepareCanvas();
		// Set event listener
		this.rootWindow.addEventListener("keydown", function (e) { e.currentTarget.rootInstance.keyDown(e); }, false);
		this.rootWindow.addEventListener("wheel", function (e) { e.currentTarget.rootInstance.wheelMove(e); }, false);
		// Create UI parts
		this.prepareTools();

		// Set initial position and velocity
		this.initFractal();

		// Start loop
		this.startLoop();
	}

	startLoop()
	{
		let root = this;
		this.timeClock = setInterval(function () { root.loop(); }, 100);
	}

	prepareCanvas()
	{
		// Initialize canvas
		this.canvas = document.createElement("canvas");
		this.canvas.rootInstance = this;
		this.canvas.id = "FractaLaVueMainPool";
		this.canvas.style.width = this.canvasWidth + "px";
		this.canvas.style.height = this.canvasHeight + "px";
		this.rootWindow.appendChild(this.canvas);
		this.canvas.addEventListener(
		    "windowdrag",
		    function (e) {
			    let style = window.getComputedStyle(e.currentTarget);
			    e.currentTarget.width = parseInt(style.width, 10);
			    e.currentTarget.height = parseInt(style.height, 10);
			    let root = e.currentTarget.rootInstance;
			    root.displayOffset.x = e.currentTarget.width / 2.0;
			    root.displayOffset.y = e.currentTarget.height / 2.0;
		    },
		    false);
		this.canvas.addEventListener("mousedown", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("mousemove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("touchstart", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("touchmove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("dblclick", function (e) { e.currentTarget.rootInstance.mouseDblClick(e); }, false);
		this.context = this.canvas.getContext("2d");
		// Initialize canvas size
		let canvasStyle = window.getComputedStyle(this.canvas);
		this.canvas.width = parseInt(canvasStyle.width, 10);
		this.canvas.height = parseInt(canvasStyle.height, 10);
		// Initialize bitmap
		this.bitmap = this.context.createImageData(this.canvas.width, this.canvas.height);
		// Set alpha of all pixels equal to 1.0
		for (let i = 0; i < this.canvas.width * this.canvas.height; i++) {
			this.bitmap.data[4 * i + 3] = 255;
		}
	}

	prepareTools()
	{
		this.overwritingButton = document.createElement("div");
		this.overwritingButton.rootInstance = this;
		this.overwritingButton.innerHTML = "Overwriting";
		this.overwritingButton.id = "FractaLaVueOverWritingButton";
		this.overwritingButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchOverwriting(e); }, false);
		this.overwritingButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchOverwriting(e); }, false);
		this.rootWindow.appendChild(this.overwritingButton);

		this.view3DButton = document.createElement("div");
		this.view3DButton.rootInstance = this;
		this.view3DButton.innerHTML = "3D view switch (normal)";
		this.view3DButton.id = "FractaLaVueView3DButton";
		this.view3DButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchView3D(e); }, false);
		this.view3DButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchView3D(e); }, false);
		this.rootWindow.appendChild(this.view3DButton);
	}

	makeColormap()
	{
		let dc = 255 / (this.colormapQuantize / 2);
		// Make colormap normal
		for (let i = 0; i <= Math.floor(this.colormapQuantize / 2); i++) {
			this.colormap.normal[i] = 'rgb(0,' + Math.min(255, Math.ceil(dc * i)) + ',' + Math.max(0, 255 - Math.ceil(dc * i)) + ')';
		}
		for (let i = Math.floor(this.colormapQuantize / 2); i < this.colormapQuantize; i++) {
			this.colormap.normal[i] = 'rgb(' + Math.min(255, Math.ceil(dc * (i - this.colormapQuantize / 2))) + ',' + Math.max(0, 255 - Math.ceil(dc * (i - this.colormapQuantize / 2))) + ',0)';
		}
		// Make colormap bluesea
		dc = 255 / this.colormapQuantize;
		for (let i = 0; i < this.colormapQuantize; i++) {
			this.colormap.bluesea[i] = 'rgb(' + Math.min(255, Math.ceil(dc / 2 * i)) + ',' + Math.min(255, Math.ceil(dc * i)) + ',255)';
		}
	}

	initFractal() {
		this.fractalTimeCurrent = 0;
		for (let m = 0; m < this.canvas.height; m++) {
			for (let n = 0; n < this.canvas.width; n++) {
				this.fractalMap[this.canvas.width * m + n] = {
					t: 0,
					z: {re: 0, im: 0}};
			}
		}
	}


	// ----- Start Simulation -----
	loop()
	{
		if (!this.loopEnded) {
			return;
		}
		this.calculate();
		this.draw();
		this.loopEnded = true;
	}



	// ----- REALTIME -----
	calculate()
	{
		for (let t = 0; t < 10; t++) {
			this.fractalTimeCurrent += 1;
			for (let m = 0; m < this.canvas.height; m++) {
				for (let n = 0; n < this.canvas.width; n++) {
					let z = this.fractalMap[this.canvas.width * m + n].z;
					let zp = this.c_plus(
						this.c_mult(z, z),
						{
							re: this.camera.pos.x + (n - this.canvas.width / 2.0) / this.viewScale,
							im: this.camera.pos.y + (m - this.canvas.height / 2.0) / this.viewScale
						});
					this.fractalMap[this.canvas.width * m + n].z = zp;
					if (this.c_abs(zp) < 2.0) {
						this.fractalMap[this.canvas.width * m + n].t += 1;
					}
				}
			}
		}
	}

	c_plus(z1, z2)
	{
		return {re: z1.re + z2.re, im: z1.im + z2.im};
	}

	c_mult(z1, z2)
	{
		return {re: z1.re * z2.re - z1.im * z2.im,
			im: z1.im * z2.re + z1.re * z2.im};
	}

	c_abs(z)
	{
		return Math.sqrt(z.re * z.re + z.im * z.im);
	}

	draw()
	{
		this.drawPlane(this.camera);
	}

	drawPlane(camera)
	{
		for (let m = 0; m < this.canvas.height; m++) {
			for (let n = 0; n < this.canvas.width; n++) {
				if (this.c_abs(this.fractalMap[this.canvas.width * m + n].z) < 2.0) {
					this.bitmap.data[4 * (this.canvas.width * m + n)] = 255;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = 255;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = 0;
				} else {
					let time = Math.pow(this.fractalMap[this.canvas.width * m + n].t / this.fractalTimeCurrent, 0.18);
					this.bitmap.data[4 * (this.canvas.width * m + n)] = Math.ceil(time * 255);
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = 0;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = 0;
				}
			}
		}
		this.context.putImageData(this.bitmap, 0, 0);
	}

	moveCamera(x, y, z)
	{
		this.camera.pos.x +=
		    x * this.camera.view.X.x +
		    y * this.camera.view.Y.x +
		    z * this.camera.view.Z.x;
		this.camera.pos.y +=
		    x * this.camera.view.X.y +
		    y * this.camera.view.Y.y +
		    z * this.camera.view.Z.y;
		this.camera.pos.z +=
		    x * this.camera.view.X.z +
		    y * this.camera.view.Y.z +
		    z * this.camera.view.Z.z;
	}

	mouseClick(event)
	{
		event.preventDefault();
		let root = this;
		if (event.type === "mousedown") {
			//this.prev_mouse = {clientX: event.clientX, clientY: event.clientY};
			this.prev_mouse = this.pointerPositionDecoder(event);
		} else if (event.type === "touchstart") {
			let touches_current = Array.from(event.touches);
			this.prev_touches = touches_current.map(this.extractTouches, this);
			if (this.touchCounting && event.touches.length == 1) {
				this.touchDblTap(event);
			}
			if (event.touches.length == 1) {
				// Set touchCounting should be at end of event processing
				this.touchCounting = true;
				clearTimeout(this.touchCounter);
				this.touchCounter = setTimeout(function () { root.touchCounting = false; }, 200);
			}
		}
	}

	mouseMove(event)
	{
		event.preventDefault();
		if (event.type === "mousemove") {
			let pointer = this.pointerPositionDecoder(event);
			let move = {x: 0, y: 0};
			move.x = pointer.x - this.prev_mouse.x;
			move.y = pointer.y - this.prev_mouse.y;
			if ((event.buttons & 1) != 0) {
				this.rotCamera(
				    -2.0 * Math.PI * move.x / this.rotDegree,
				    2.0 * Math.PI * move.y / this.rotDegree);
			} else if ((event.buttons & 4) != 0) {
				this.moveCamera(move.x, move.y, 0);
			}
			this.prev_mouse = {x: pointer.x, y: pointer.y};
		} else if (event.type === "touchmove") {
			let touches_current = Array.from(event.touches);
			let move = {x: 0, y: 0};
			if (touches_current.length == 1) {
				let pointer = this.pointerPositionDecoder(touches_current[0]);
				let n = this.prev_touches.findIndex(function (element, index, touches) {
					if (element.identifier == this[0].identifier) {
						return true;
					} else {
						return false;
					}
				    },
				    touches_current);
				if (n >= 0) {
					move.x = pointer.x - this.prev_touches[n].x;
					move.y = pointer.y - this.prev_touches[n].y;
					this.rotCamera(
					    -2.0 * Math.PI * move.x / this.rotDegree,
					    2.0 * Math.PI * move.y / this.rotDegree);
				}
			} else if (touches_current.length == 2 && this.prev_touches.length == 2) {
				let p0 = this.prev_touches[0];
				let p1 = this.prev_touches[1];
				let r0 = this.pointerPositionDecoder(touches_current[0]);
				let r1 = this.pointerPositionDecoder(touches_current[1]);
				move.x = ((r0.x + r1.x) - (p0.x + p1.x)) * 0.5;
				move.y = ((r0.y + r1.y) - (p0.y + p1.y)) * 0.5;
				let dp = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
				let d = Math.sqrt(Math.pow(r0.x - r1.x, 2) + Math.pow(r0.y - r1.y, 2));
				this.moveCamera(move.x, move.y, d - dp);
			}
			this.prev_touches = touches_current.map(this.extractTouches, this);
		}
	}

	pointerPositionDecoder(pointer)
	{
		let rect = this.rootWindow.getBoundingClientRect();
		let pos = {
			x: pointer.clientX - rect.left,
			y: pointer.clientY - rect.top
		};
		return pos;
	}

	extractTouches(a)
	{
		let pos = this.pointerPositionDecoder(a);
		return {x: pos.x, y: pos.y, identifier: a.identifier};
	}

	wheelMove(event)
	{
		event.preventDefault();
		this.moveCamera(0, 0, -event.deltaY);
	}

	mouseDblClick(event)
	{
		event.preventDefault();
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event);
	}

	touchDblTap(event)
	{
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event.touches[0]);
	}

	keyDown(event)
	{
		switch (event.key) {
			case "ArrowUp":
				break;
			case "ArrowDown":
				break;
			case "ArrowLeft":
				break;
			case "ArrowRight":
				break;
		}
	}

	switchOverwriting()
	{
		this.overwriting = !this.overwriting;
	}

	switchView3D()
	{
		this.view3D = (this.view3D + 1) % 3;
		switch (this.view3D) {
			case 1:
				this.view3DButton.innerHTML = "3D view switch (cross)";
				this.overwritingButton.style.opacity = "0.0";
				break;
			case 2:
				this.view3DButton.innerHTML = "3D view switch (parallel)";
				this.overwritingButton.style.opacity = "0.0";
				break;
			default:
				this.view3DButton.innerHTML = "3D view switch (normal)";
				this.overwritingButton.style.opacity = "1.0";
		}
	}
}
