/**
 * MCQ
 * VERSION: 2.5
 * JS
 * AUTHOR: Ian Duff
 * EMAIL: ian.duff@essemble.co.uk
 * COPYRIGHT: Essemble Ltd
 * All code © 2019 Essemble Ltd. all rights reserved
 * This code is the property of Essemble Ltd and cannot be copied, reused or modified without prior permission from the author
 **/

function MCQ(vars) {
	//constructor
	//note: quiz extends this function
	this._screen = vars.element._screen;
	this._element = vars.element;
	this._container = vars.element._container;
	this._xml = vars.element._xml;
	
	this._arQs = [];//question array
	this._iCurQ = 0;//current question
	this._fb = null;
	
	//read the settings
	//<settings radiobutton="true" radiobuttonx="10" radiobuttony="10" correctx="-20" correcty="8"/>
	var settings = this._xml.find("settings");
	if(settings.length > 0){
		this._radioBtn = xmlAttrBoo(settings,"radiobutton",false);
		this._radioBtnX = xmlAttrStr(settings,"radiobuttonx") || "0px";
		this._radioBtnY = xmlAttrStr(settings,"radiobuttony") || "0px";
		this._correctX = xmlAttrStr(settings,"correctx") || "0px";
		this._correctY = xmlAttrStr(settings,"correcty") || "0px";
		this._maxAttempts = xmlAttrNum(settings,"attempts") || null;
		this._forceMany = xmlAttrBoo(settings,"manyfrommany",false);
		this._cheatMode = xmlAttrBoo(settings,"cheatmode",false)
	}

	//question container
	this._questionContainer = create({ type: "div", className: "questionContainer" });
	this._container.appendChild(this._questionContainer);
	
	var scope = this;
	$(this._xml).find('question').each(function () {
		scope.makeQuestionObj($(this))
    });
}

MCQ.prototype = {
	//MCQ methods
	makeQuestionObj:function(xml){
		//for each question create a question object
		//methods to return the current question elements, options object and feedback object by id.
		var qObj = {};
		qObj._id = xml.attr("id") || "question" + this._arQs.length+1;
		qObj._time = xmlAttrNum(xml,"time") || 0;
		qObj._xml = xml;
		qObj._elements = [];
		qObj._arOptions = [];
		qObj._arFbs = [];
		qObj._radioMode = true;
		qObj._passed = false;
		qObj._numAttempts = 0;
		qObj._event = xmlAttrStr(xml,"event");
		qObj._collection = null;
		
		qObj.getElementById = function(id){
			var ret = null;
			for (var i=0;i<this._elements.length;i++){
				if(this._elements[i]._id == id){
					ret = this._elements[i];
					break;
				}
			}
			return ret;
		}
		qObj.getOptionById = function(id){
			var ret = null;
			for (var i=0;i<this._arOptions.length;i++){
				if(this._arOptions[i]._id == id){
					ret = this._arOptions[i];
					break;
				}
			}
			return ret;
		}
		qObj.getFeedbackById = function(id){
			var ret = null;
			for (var i=0;i<this._arFbs.length;i++){
				if(this._arFbs[i]._id == id){
					ret = this._arFbs[i];
					break;
				}
			}
			return ret;
		}

		var correctCount = 0;
		var scope = this;
		$(xml).children().each(function(){
			var nodeType = this.tagName;
			switch(nodeType){
				case "option":
					var qOptionObj = {};
					qOptionObj._correct = Boolean($(this).attr("correct").toLowerCase() == "true");
					if(qOptionObj._correct) correctCount++;
					if(correctCount > 1 || scope._forceMany) qObj._radioMode = false;
					qOptionObj._selected = false;
					
					var firstElement = $(this).children()[0];
					var collectionId = qObj._id + "_initialload";
					var el = scope._screen.createElement({xml:firstElement, load:false, collection:collectionId});
					if(el) {
						el._target = scope._questionContainer;
						qOptionObj._element = el;
						qOptionObj._id = el._id;
						qObj._elements.push(el);
					}
					qObj._arOptions.push(qOptionObj);
				break;
				
				case "fb":
					var fbObj = {};
					fbObj._id = $(this).attr("id");
					fbObj._event = xmlAttrStr($(this),"event");
					var collectionId = qObj._id + "_feedback_" + fbObj._id;
					fbObj._collection = collectionId
					$(this).children().each(function(){
						var el = scope._screen.createElement({xml:this, load:false, collection:collectionId});
						if(el){
							if(!el._target) el._target = scope._questionContainer;
						}
					})
					qObj._arFbs.push(fbObj);
				break;
				
				default:
					//all other elements, e.g. buttons (confirm & reset), additional text, images, audio, video
					var collectionId = qObj._id + "_initialload";
					qObj._collection = collectionId;
					var el = scope._screen.createElement({xml:this, load:false, collection:collectionId});
					if(el) {
						if(!el._target) el._target = scope._questionContainer;
						qObj._elements.push(el);
					}
				break;
			}
		});

		this._arQs.push(qObj);
	},
	
	init:function(){
		this.loadQuestion(this._iCurQ);
	},

	loadQuestion:function(id){
		this._iCurQ = id;
		var q = this.curQ();

		if(this._radioBtn){
			var existing = $(q._arOptions[0]._element._container).find(".radioBtn");
			if(existing.length == 0) {
				for (var i=0;i<q._arOptions.length;i++){
					var rb = create({type:"div", className:"radioBtn"})
					$(rb).css("position","absolute");
					$(rb).css("left",getUnit(this._radioBtnX));
					$(rb).css("top",getUnit(this._radioBtnY));
					$(q._arOptions[i]._element.container()).prepend(rb);
				}
			}
		}

		var array = q._elements;
		var loader = new ElementLoader({screen:this._screen, elements:array});
		loader.load();

		if(this._cheatMode) this.showAllCorrectAnswers();
	},
	
	select:function(element){
		var q = this.curQ();
		var selectedOption = q.getOptionById(element._id);
		
		if(q._radioMode){
			element.disable();
			for (var i=0; i<q._arOptions.length;i++){
				if(q._arOptions[i]._element != element){
					q._arOptions[i]._element.enable();
					q._arOptions[i]._selected = false;
					q._arOptions[i]._element._selected = false;//required for element onblur event
				} 
			}
			selectedOption._selected = true;
      		element._selected = true;//required for element onblur event
			this.optionSelect(element);
		} else {
			if(selectedOption._selected){
				//deselect
				selectedOption._selected = false;
				element._selected = false;//required for element onblur event
				element.enable();
				element.rollout();
				$(element._container).on('mouseenter', element.mouseOverHandler.bind(element));
				$(element._container).on('mouseleave', element.mouseOutHandler.bind(element));
				this.optionOut(element);
			} else {
				//select
				//disable rollover events
				selectedOption._selected = true;
				element._selected = true;//required for element onblur event
				$(element._container).off('mouseenter');
				$(element._container).off('mouseleave');
				this.optionSelect(element);
			}
		}

		//if any of the options have been selected, enable the confirm btn, otherwise disable it
		var bEnable = false;
		for (var i=0; i<q._arOptions.length;i++) {
			if(q._arOptions[i]._selected) bEnable = true;
		}
		
		var confirmBtn = q.getElementById("submitBtn");
		if(confirmBtn){
			bEnable ? confirmBtn.enableBtn() : confirmBtn.disableBtn();
		}
	},

	deselect:function(list){
		var listAr = list.split(",");
		var optionObj;
		var q = this.curQ();
		for (var i=0;i<listAr.length;i++){
			optionObj = q.getOptionById(listAr[i]);
			if(optionObj._selected){
				//deselect
				optionObj._selected = false;
				optionObj._element.enable();
				optionObj._element.rollout();
				$(optionObj._element._container).on('mouseenter', optionObj._element.mouseOverHandler.bind(optionObj._element));
				$(optionObj._element._container).on('mouseleave', optionObj._element.mouseOutHandler.bind(optionObj._element));
				this.optionOut(optionObj._element);					
			} 
		}
	},
	
	optionOver:function(element){
		if(this._radioBtn) $(element.container()).find(".radioBtn").addClass("selected");
	},
	
	optionOut:function(element){
		if(this._radioBtn) $(element.container()).find(".radioBtn").removeClass("selected");		
	},
	
	optionSelect:function(element){
		if(this._radioBtn) $(element.container()).find(".radioBtn").addClass("selected");		
	},
	
	submit:function(element){
		var q = this.curQ();
		q._numAttempts++;
		q._passed = false;
		var optionCorrectCount = 0;
		var userCorrectCount = 0;
		var allCorrect = false;
		var selectedOptionPos = null;
		var count = 0;
		var bPartial = false;
		
		//disable confirm, enable reset
		var confirmBtn = q.getElementById("submitBtn");
		if(confirmBtn) confirmBtn.disableBtn();
		
		var resetBtn = q.getElementById("resetBtn");
		if(resetBtn) resetBtn.enableBtn();
		
		//disable options and work out which ones answered correctly
		for (var i=0;i<q._arOptions.length;i++) {
			q._arOptions[i]._element.disable();
			if(q._arOptions[i]._correct) { 
				optionCorrectCount++; 
			};
			if(q._arOptions[i]._selected && q._arOptions[i]._correct) { userCorrectCount++; bPartial = true;  };
			if(q._arOptions[i]._selected && !q._arOptions[i]._correct) { 
				userCorrectCount--; 
			}
			if(q._arOptions[i]._selected) {
				selectedOptionPos = (count+1);
			}
			count++;
		}
		
		//does the selected option have specific feedback? (returns null if not)
		var spFb = q.getFeedbackById(selectedOptionPos);
		var oFb;

		if(userCorrectCount == optionCorrectCount){
			//all correct
			q._passed = true;	//flag question as passed
			spFb ? oFb = spFb : oFb = q.getFeedbackById("pass");			
		} else if (bPartial){
			//some correct
			spFb ? oFb = spFb : oFb = q.getFeedbackById("partial");
		} else {
			//none correct
			spFb ? oFb = spFb : oFb = q.getFeedbackById("fail");
		}
		
		if(oFb){ this.loadFeedback(oFb); }
		this.showCorrectAnswers();
		
		//enable sca if appropriate
		if(userCorrectCount != optionCorrectCount){
			var scaBtn = q.getElementById("scaBtn");
			if(scaBtn){ 
				if(this._maxAttempts){						
					if(q._numAttempts >= this._maxAttempts){
						scaBtn.enableBtn(); 
					}
				} 
			}
		}
	},
	
	showCorrectAnswers:function(){
		var q = this.curQ();
		for (var i=0;i<q._arOptions.length;i++) {
			if(q._arOptions[i]._correct && q._arOptions[i]._selected){
				var existing = $(q._arOptions[i]._element._container).find(".tick");
				if(existing.length == 0) {
					var correct = create({type:"i", className:"material-icons tick", innerHTML:"&#xE5CA;"});
					$(correct).css("position","absolute");
					$(correct).css("left",getUnit(this._correctX));
					$(correct).css("top",getUnit(this._correctY));
					$(correct).css("z-index",2);
					$(q._arOptions[i]._element._container).prepend(correct);
				}
			}
		}
	},
	
	showAllCorrectAnswers:function(){
		var q = this.curQ();
		for (var i=0;i<q._arOptions.length;i++) {
			if(q._arOptions[i]._correct){
				var existing = $(q._arOptions[i]._element._container).find(".tick");
				if(existing.length == 0) {
					var correct = create({type:"i", className:"material-icons tick indicate_correct", innerHTML:"&#xE5CA;"});
					$(correct).css("position","absolute");
					$(correct).css("left",getUnit(this._correctX));
					$(correct).css("top",getUnit(this._correctY));
					$(correct).css("z-index",2);
					$(q._arOptions[i]._element._container).prepend(correct);
				}
			}
		}
	},
	
	reset:function(element){
		var q = this.curQ();
		var confirmBtn = q.getElementById("submitBtn");
		if(!confirmBtn) confirmBtn = this._screen.getElementById("submitBtn");
		if(confirmBtn){ confirmBtn.reset(); }
		
		var resetBtn = q.getElementById("resetBtn");
		if(!resetBtn) resetBtn = this._screen.getElementById("resetBtn");
		if(resetBtn){ resetBtn.reset(); }

		var scaBtn = q.getElementById("scaBtn");
		if(!scaBtn) scaBtn = this._screen.getElementById("scaBtn");
		if(scaBtn){ scaBtn.reset(); }
		
		//re-set the options
		for (var i=0;i<q._arOptions.length;i++) {
			q._arOptions[i]._selected = false;
			q._arOptions[i]._element._selected = false;//required for element onblur event
			q._arOptions[i]._element.enable();
			this.optionOut(q._arOptions[i]._element);
			
			//remove any ticks
			var correct = $(q._arOptions[i]._element._container).find(".tick");
			if(correct.length > 0) $(correct).remove();
		}
		
		//unload the feedback elements
		this.removeFeedback();
	},
	
	sca:function(vars){
		var q = this.curQ();
		var scaBtn = q.getElementById("scaBtn");
		if(!scaBtn) scaBtn = this._screen.getElementById("scaBtn");
		if(scaBtn){ scaBtn.reset(); }
		
		var oFb = q.getFeedbackById("generic");
		if(oFb){
			this.removeFeedback();
			this.loadFeedback(oFb);
		}
		this.showAllCorrectAnswers();
	},
	
	curQ:function(){
		return this._arQs[this._iCurQ];
	},

	loadFeedback:function(oFb){
		this._fb = oFb;//flag the current loaded feedback
		var array = this._screen.getElementsByCollection(oFb._collection);
		this._fb._elements = array;
		
		//load the feedback elements
		var scope = this;
		var fbLoader = new ElementLoader({screen:this._screen, elements:array, onLoadComplete:"feedbackLoadComplete", onCompleteScope:this});
		fbLoader.load();
		
		//fire any events defined for the feedback
		if(oFb._event) {
			this._screen.doClickEventsFromStr(oFb._event,null);
		}
	},

	removeFeedback:function(){
		if(this._fb){
			for (var i=0;i<this._fb._elements.length;i++){
				$(this._fb._elements[i]._container).remove();
			}
		}
	},

	feedbackLoadComplete:function(){
		this.scrollToBottom();
		this.updateMathJax();
	},

	updateMathJax:function(){
		if(typeof(MathJax) != "undefined") {
			MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
		}
	},

	scrollToTop:function(){
		//return false //to disable
		var target = document.body;
		var el = this._screen._container;
		var scrollYPos = ($(el).offset().top) - $(target).offset().top;

		$('html, body').animate({ 
		   scrollTop: scrollYPos}, 
		   1000, 
		   "easeOutQuint"
		)
	},

	scrollToBottom:function(){
		//return false //to disable
		var target = document.body;
		var el = this._screen._container;
		var th = $(target).outerHeight();
		var eh = $(el).outerHeight();
		var diff = th - eh;
		var scrollYPos = $(el).offset().top - $(target).offset().top - diff;
		var curYPos = target.scrollTop;

		if(scrollYPos > curYPos){
			$('html, body').animate({ 
			   scrollTop: scrollYPos}, 
			   1000, 
			   "easeOutQuint"
			)
		}
	},
	
} //end prototype object
