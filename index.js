const wiki = require('wikijs').default;
var MediaWiki = require("mediawiki");
var bot = new MediaWiki.Bot();

bot.settings.endpoint = "https://fr.wikipedia.org/w/api.php";

getAllPagesWithInfobox( "Modèle:Infobox_Préfecture_du_Japon", function (res) {
    console.log(res);
    console.log(res.length);
})
getAllPagesWithInfobox( "Modèle:Infobox_Municipalité_du_Canada", function (res) {
    console.log(res);
    console.log(res.length);
});
/*
wiki().page('Batman')
    .then(page => page.info('alterEgo'))
    .then(console.log); // Bruce Wayne
    */

function getAllPagesWithInfobox(name, sucess) {
    bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500 }).complete(function (response) {
	results = [];
	results = results.concat(response.query.embeddedin);
	if (response.continue) {
	    query(name, response.continue.eicontinue);
	} else {
	    sucess(results);
	}
    });
    function query(name, eicontinue) {
	bot.get({ action: "query", list: "embeddedin", eititle: name, eilimit: 500, eicontinue: eicontinue }).complete(function (response) {
	    results = results.concat(response.query.embeddedin);
	    if (response.continue) {
		query(name, response.continue.eicontinue);
	    } else {
		sucess(results);
	    }
	});
    }


}
