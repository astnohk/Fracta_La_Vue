window.addEventListener("load", initSystem, false);

var SystemRoot;
var FractaLaVueWindow;
var FractaLaVueApplication;

function
initSystem()
{
	SystemRoot = new ECMASystem(document.body);

	FractaLaVueWindow = SystemRoot.createWindow({id: "FractaLaVue", noCloseButton: null});
	FractaLaVueWindow.style.position = "absolute";
	FractaLaVueWindow.style.top = "0px";
	FractaLaVueWindow.style.left = "0px";
	FractaLaVueWindow.style.width = "100%";
	FractaLaVueWindow.style.height = "100%";
	FractaLaVueWindow.style.padding = "0";
	FractaLaVueWindow.style.outline = "0";
	FractaLaVueWindow.style.border = "0";
	FractaLaVueWindow.style.backgroundColor = "rgba(20, 20, 20, 0.5)";
	document.body.appendChild(FractaLaVueWindow);

	FractaLaVueApplication = new FractaLaVue(SystemRoot, FractaLaVueWindow);
	SystemRoot.windowScroller.style.display = "none";
}

