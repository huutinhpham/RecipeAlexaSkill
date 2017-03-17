'use strict';

console.log('Loading function');

const doc = require('dynamodb-doc');

const dynamo = new doc.DynamoDB();

/**
 * Demonstrates a simple HTTP endpoint using API Gateway. You have full
 * access to the request and response payload, including headers and
 * status code.
 *
 * To scan a DynamoDB table, make a GET request with the TableName as a
 * query string parameter. To put, update, or delete an item, make a POST,
 * PUT, or DELETE request respectively, passing in the payload to the
 * DynamoDB API as a JSON body.
 */
exports.handler = (event, context, callback) => {

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    switch (event.httpMethod) {
        case 'DELETE':
            dynamo.deleteItem(JSON.parse(event.body), done);
            break;
        case 'GET':
            dynamo.scan({ TableName: event.queryStringParameters.TableName }, done);
            break;
        case 'POST':
            dynamo.putItem(JSON.parse(event.body), done);
            break;
        case 'PUT':
            dynamo.updateItem(JSON.parse(event.body), done);
            break;
        default:
            try {
                console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        
                // if (event.session.application.applicationId !== "amzn1.ask.skill.50c44d6a-970c-48f4-923f-7bb32f6a0196") {
                //     context.fail("Invalid Application ID");
                // }
                
                if (event.session.new) {
                    onSessionStarted({requestId: event.request.requestId}, event.session);
                }
        
                if (event.request.type === "LaunchRequest") {
                        onLaunch(event.request,
                            event.session,
                            function callback(sessionAttributes, speechletResponse) {
                                context.succeed(buildResponse(sessionAttributes, speechletResponse));
                            });
                    
                } else if (event.request.type === "IntentRequest") {
                    onIntent(event.request,
                        event.session,
                        function callback(sessionAttributes, speechletResponse) {
                            context.succeed(buildResponse(sessionAttributes, speechletResponse));
                        });
                        
                } else if (event.request.type === "SessionEndedRequest") {
                    context.succeed();
                }
            } catch (e) {
                context.fail("Exception: " + e);
            }
    }
    
};

var sessionAttributes = {
    "mode" : "main menu",
    "recipeName": "",
    "recipe": [],
    "ingredients": [],
    "step" : 0,
    "DB": ""
};

    function getDB(recipeName) {
        

        var params = {
            TableName: "RecipeList"
         };
        
        dynamo.scan(params, function(err,data){
            if (err) { 
                console.log(err, err.stack);
            } else {
                console.log(data);
                for (var i = 0; i<data["Items"].length; i++) {
                    var curItem = data["Items"][i];
                    var curName = curItem["RecipeName"];
                    if (curName == recipeName) {
                        console.log([curItem["PrepDirections"].split("+"), curItem["IngredientsList"].split("+")]);
                    }
                }
            }
        });
    }

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session, callback) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);
        
    callback(sessionAttributes,
        buildSpeechletResponse("recipe assistant, what recipe would you like to make?", false));
}

//hard coded variable used for testing, replace it with real db items some how
var recipe = ["1. Beat eggs, water, salt and pepper in small bowl until blended",
              "2. Heat butter in 7 to 10-inch nonstick omelet pan or skillet over medium-high heat until hot. TILT pan to coat bottom.",
              "3. Pour in egg mixture. Mixture should set immediately at edges.",
              "4. Gently push cooked portions from edges toward the center with inverted turner so that uncooked eggs can reach the hot pan surface.",
              "5. When top surface of eggs is thickened and no visible liquid egg remains, place filling on one side of the omelet.",
              "6. fold omelet in half with turner. With a quick flip of the wrist, turn pan and INVERT or SLIDE omelet onto plate. Serve immediately."];
var ingredients = ["2 Eggs",
                   "2 table spoon of water",
                   "1/8 tea spoon of salt",
                   "a dash of pepper",
                   "1 tea spoon of butter",
                   "1/2 to 1/3 cup of filling such as cheddar cheese, mushrooms, baby spinach, etc."];

function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);
    
    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;
        sessionAttributes = session.attributes;
        
    if (intentName === "RecipeIntent") {
        var recipeSlot = intent.slots.Recipe;
        var recipeName;
        var recipeList = [];
        if (recipeSlot && recipeSlot.value) {
            recipeName = recipeSlot.value.toLowerCase();
            getDB(recipeName);
            // if (recipeList.length === 0) {
            //     callback(sessionAttributes,
            //         buildSpeechletResponse("Sorry, I don't know that recipe", false));
            // } else {
            //     sessionAttributes.recipe = recipeList[0];
            //     sessionAttributes.ingredients = recipeList[1];
                sessionAttributes.recipeName = recipeName;
                session.attributes = sessionAttributes;
                makeFood(intent, session, callback);
            // }
        } else {
            callback(sessionAttributes,
                    buildSpeechletResponse("Sorry, I don't know that recipe", false));
        }
    } else if (intentName === "IngredientIntent") {
      listIngredients(intent, session, callback);
    } else if (intentName === "TransitionIntent") {
      transition(intent, session, callback);
    } else if (intentName === "HelpIntent") {
        help(intent, session, callback);
    } else {
        repeat(intent, session, callback);
    }
    
}

function makeFood(intent, session, callback) {
    
    //replace recipe with the one in db
    
    sessionAttributes = session.attributes;
    
    sessionAttributes.recipe = recipe;
    sessionAttributes.mode = "recipe mode";
    sessionAttributes.step = 0;
    
    callback(sessionAttributes,
        buildSpeechletResponse("When you are ready to cook " + sessionAttributes.recipeName + ". Say start.", false));
}

function listIngredients(intent, session, callback) {
    
    //replace ingredients with the one in the db
    
    sessionAttributes = session.attributes;
    
    sessionAttributes = session.attributes;
    sessionAttributes.ingredients = ingredients;
    sessionAttributes.mode = "ingredient mode"
    
    
    sessionAttributes.step = 0;
    
    callback(sessionAttributes,
             buildSpeechletResponse("When you are ready for the list of ingredients for " + sessionAttributes.recipeName + ". Say start.", false));
}

function transition(intent, session, callback) {

    sessionAttributes = session.attributes;
    
    var transition = intent.slots.Transition.value;
    var outputText = "";
    
    
    
    
    //next ingredient or recipe step
    if (transition === "next" || transition === "start" || transition === "read recipe") {
        if (sessionAttributes.mode === "main menu") {
            outputText = "Please choose a recipe first"
        } else {
            var step;
            if (transition === "next") {
                step = sessionAttributes.step + 1;
            } else if (transition === "start") {
                step = 1;
            } else if (transition === "read recipe") {
                step = 1;
                sessionAttributes.mode = "recipe mode";
            }
        
            sessionAttributes.step = step;
        
            if (sessionAttributes.mode === "ingredient mode") {
                if (step > sessionAttributes.ingredients.length) {
                    makeFood(intent, session, callback);
                } else {
                    outputText = sessionAttributes.ingredients[step - 1];
                }
            } else if (sessionAttributes.mode === "recipe mode") {
                if (step > sessionAttributes.recipe.length) {
                    outputText = "There are no more steps"
                } else {
                    outputText = sessionAttributes.recipe[step - 1];
                }
            }
        }
    }
    
    //last ingredient or recipe step
    if (transition === "last") {
        if (sessionAttributes.mode === "main menu") {
            outputText = "Please choose a recipe first"
        } else {
            var step = sessionAttributes.step - 1;
            sessionAttributes.step = step;
            if (sessionAttributes.mode === "ingredient mode") {
                if (step < 0) {
                    outputText = "There are no previous ingredient";
                    sessionAttributes.step = 0;
                } else {
                    outputText = sessionAttributes.ingredients[step - 1];
                }
            } else if (sessionAttributes.mode === "recipe mode") {
                if (step < 0) {
                    outputText = "There are no previous step";
                    sessionAttributes.step = 0;
                } else {
                    outputText = sessionAttributes.recipe[step - 1];
                }
            }
        }
    }
    
    //exit transition
    
    if (transition === "main menu" || transition === "quit" || transition === "exit") {
        if (sessionAttributes.mode === "recipe mode" || sessionAttributes.mode === "ingredients mode" || transition === "main menu") {
            onLaunch(intent, session, callback);
        } else {
            handleFinishSessionRequest(intent, session, callback);
        }
    }
    
    callback(sessionAttributes,
             buildSpeechletResponse(outputText, false));
}

function help(intent, session, callback) {
    sessionAttributes = session.attributes;
    var outputText = "You can say: ";
    
    if (sessionAttributes.mode === "recipe mode"){
        outputText +=  "read recipe. ";
        outputText +=  "start. ";
        outputText +=  "start again. ";
        outputText +=  "next step. ";
        outputText +=  "last step. ";
        outputText +=  "main menu. ";
        outputText +=  "exit. ";
        outputText +=  "and quit.";
    } else if (sessionAttributes.mode === "ingredient mode") {
        outputText +=  "start again. ";
        outputText +=  "next ingredient. ";
        outputText +=  "last ingredient. ";
        outputText +=  "main menu. ";
        outputText +=  "exit. ";
        outputText +=  "and quit.";       
    } else if (sessionAttributes.mode === "main menu") {
        outputText += "how do I make, following with a type of food you wish to make."
    }
    
    callback(sessionAttributes,
        buildSpeechletResponse(outputText, false));
}


function handleFinishSessionRequest(sessionEndedRequest, session, callback) {
    callback(session.attributes,
        buildSpeechletResponse("Good bye!", true));
}

/**
 * Speech Output functions
 */
function buildSpeechletResponse(outputText, shouldEndSession) {
        return {
        outputSpeech: {
            type: "PlainText",
            text: outputText
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };

}