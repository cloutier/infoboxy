const wiki = require('wikijs').default;
var MediaWiki = require("mediawiki");
var bot = new MediaWiki.Bot();

bot.settings.endpoint = "https://fr.wikipedia.org/w/api.php";


bot.get({ action: "query", list: "embeddedin", eititle: "Modèle:Infobox_Municipalité_du_Canada", eilimit: 5000 }).complete(function (response) {
    console.log(response.warnings);
    console.log(response.continue);
    console.log(response.query.embeddedin.length);
    bot.get({ action: "query", list: "embeddedin", eititle: "Modèle:Infobox_Municipalité_du_Canada", eilimit: 5000, eicontinue: response.continue.eicontinue }).complete(function (response) {
	console.log(response);
//	console.log(response.warnings);
//	console.log(response.continue);
//	console.log(response.query.embeddedin.length);
    });
});

wiki().page('Batman')
    .then(page => page.info('alterEgo'))
    .then(console.log); // Bruce Wayne
