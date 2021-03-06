'use strict';

console.log('Loading function');

const doc = require('dynamodb-doc');

var dynamo = new doc.DynamoDB();

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
            'Content-Type': 'application/json','Access-Control-Allow-Headers': 'x-requested-with',
            "Access-Control-Allow-Origin" : "*", "Access-Control-Allow-Credentials" : true,
        },
    });

    if (event.httpMethod) {
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
                done(new Error(`Unsupported method "${event.httpMethod}"`));
        }
    } else {
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
    "DB": []
};

function getDB(recipeName, callback) {
        
    var params = {
      TableName: "RecipeList"
    };
        
    dynamo.scan(params, function(err,data){
        if (err) { 
            console.log(err, err.stack);
        } else {
            for (var i = 0; i<data["Items"].length; i++) {
                var curItem = data["Items"][i];
                var curName = curItem["RecipeName"].toLowerCase();
                if (curName == recipeName) {
                    callback([curItem["PrepDirections"].split("\n"), curItem["IngredientsList"].split("\n")]);
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



function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);
    
    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;
        sessionAttributes = session.attributes;
        
    console.log(intentName);
    if (intentName === "PreparationIntent") {
        console.log(intent);
        var recipeSlot = intent.slots.Recipe;
        var recipeName;
        var recipeList = [];
        if (recipeSlot && recipeSlot.value) {
            recipeName = recipeSlot.value.toLowerCase();
            console.log(recipeName);
            getDB(recipeName, function (data) {
                recipeList = data;
                console.log(recipeList);
                if (recipeList.length === 0) {
                    callback(sessionAttributes,
                        buildSpeechletResponse("Sorry, I don't know that recipe", false));
                } else {
                    sessionAttributes.recipe = recipeList[0];
                    sessionAttributes.ingredients = recipeList[1];
                    sessionAttributes.recipeName = recipeName;
                    session.attributes = sessionAttributes;
                    preparation(intent, session, callback);
                }
            });
        } else {
            callback(sessionAttributes,
                    buildSpeechletResponse("Sorry, I don't know that recipe", false));
        }
    } else if (intentName === "RecipeIntent") {
        console.log(intent);
        makeFood(intent, session, callback);
    } else if (intentName === "IngredientIntent") {
        console.log(intent);
      listIngredients(intent, session, callback);
    } else if (intentName === "TransitionIntent") {
        console.log(intent);
      transition(intent, session, callback);
    } else if (intentName === "HelpIntent") {
        console.log(intent);
        help(intent, session, callback);
    } else {
        console.log(intent);
        repeat(intent, session, callback);
    }
    
}

function preparation(intent, session, callback) {
    sessionAttributes = session.attributes;
    sessionAttributes.mode = "preparation mode";
    
    callback(sessionAttributes,
        buildSpeechletResponse("If you want the recipe steps for " + sessionAttributes.recipeName + ", say recipe. If you want the ingredient list for " + sessionAttributes.recipeName + ", say ingredients.", false));
}

function makeFood(intent, session, callback) {
       
    sessionAttributes = session.attributes;

    sessionAttributes.mode = "recipe mode";
    sessionAttributes.step = 0;
    
    callback(sessionAttributes,
        buildSpeechletResponse("When you are ready to cook " + sessionAttributes.recipeName + ". Say start.", false));
}

function listIngredients(intent, session, callback) {
    
    sessionAttributes = session.attributes;
    
    sessionAttributes = session.attributes;
    sessionAttributes.mode = "ingredient mode";
    
    sessionAttributes.step = 0;
    
    callback(sessionAttributes,
             buildSpeechletResponse("When you are ready for the list of ingredients for " + sessionAttributes.recipeName + ". Say start.", false));
}

function transition(intent, session, callback) {

    sessionAttributes = session.attributes;
    
    var transition = intent.slots.Transition.value;
    var outputText = "";
    var step;
    
    
    //next ingredient or recipe step
    if (transition === "next" || transition === "start" || transition === "read recipe") {
        if (sessionAttributes.mode === "main menu") {
            outputText = "Please choose a recipe first";
        } else {
            if (transition === "next") {
                step = sessionAttributes.step + 1;
            } else if (transition === "start") {
                step = 0;
            } else if (transition === "read recipe") {
                step = 0;
                sessionAttributes.mode = "recipe mode";
            }
        
            sessionAttributes.step = step;
        
            if (sessionAttributes.mode === "ingredient mode") {
                if (step >= sessionAttributes.ingredients.length) {
                    makeFood(intent, session, callback);
                } else {
                    outputText = sessionAttributes.ingredients[step];
                }
            } else if (sessionAttributes.mode === "recipe mode") {
                if (step >= sessionAttributes.recipe.length) {
                    outputText = "There are no more steps";
                } else {
                    outputText = sessionAttributes.recipe[step];
                }
            }
        }
    }
    
    //last ingredient or recipe step
    if (transition === "last") {
        if (sessionAttributes.mode === "main menu") {
            outputText = "Please choose a recipe first";
        } else {
            step = sessionAttributes.step - 1;
            sessionAttributes.step = step;
            if (sessionAttributes.mode === "ingredient mode") {
                if (step < 0) {
                    outputText = "There are no previous ingredient";
                    sessionAttributes.step = 0;
                } else {
                    outputText = sessionAttributes.ingredients[step];
                }
            } else if (sessionAttributes.mode === "recipe mode") {
                if (step < 0) {
                    outputText = "There are no previous step";
                    sessionAttributes.step = 0;
                } else {
                    outputText = sessionAttributes.recipe[step];
                }
            }
        }
    }
    
    //exit transition
    
    if (transition === "main menu" || transition === "back" || transition === "finished" || transition === "done") {
        if (sessionAttributes.mode === "recipe mode" || sessionAttributes.mode === "ingredients mode" || sessionAttributes.mode === "preparation mode") {
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
        outputText +=  "done. ";
        outputText +=  "finished. ";
        outputText +=  "back out. ";
    } else if (sessionAttributes.mode === "ingredient mode") {
        outputText +=  "start. ";
        outputText +=  "start again. ";
        outputText +=  "next ingredient. ";
        outputText +=  "last ingredient. ";
        outputText +=  "main menu. ";
        outputText +=  "done. ";
        outputText +=  "finished. ";
        outputText +=  "back out. ";
    } else if (sessionAttributes.mode === "preparation mode") {
        outputText +=  "recipe. ";
        outputText +=  "ingredients. ";
        outputText +=  "go to recipe steps. ";
        outputText +=  "go to ingredient list. ";
    } else if (sessionAttributes.mode === "main menu") {
        outputText += "how do I make, following with a type of food you wish to make."
    }
    
    callback(sessionAttributes,
        buildSpeechletResponse(outputText, false));
}

function repeat(intent, session, callback) {
    sessionAttributes = session.attribute;
    callback(session.attributes,
        buildSpeechletResponse("I do not understand that statement. If you need help say, what can I say, for a list of possible statements.", false));
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