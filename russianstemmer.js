// Russian language stemmer

let RVRE = /^(.*?[аеиоуыэюя])(.*)$/;
let PERFECTIVEGROUND_1 = /(ив|ивши|ившись|ыв|ывши|ывшись)$/;
let PERFECTIVEGROUND_2 = /([ая])(в|вши|вшись)$/;
let REFLEXIVE = /(с[яь])$/;
let ADJECTIVE =/(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
let PARTICIPLE_1 = /(ивш|ывш|ующ)$/;
let PARTICIPLE_2 = /([ая])(ем|нн|вш|ющ|щ)$/;
let VERB_1 = /(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)$/;
let VERB_2 = /([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$/;
let NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
let I = /и$/;
let P = /ь$/;
let DERIVATIONAL = /.*[^аеиоуыэюя]+[аеиоуыэюя].*ость?$/;
let DER = /ость?$/;
let SUPERLATIVE = /(ейше|ейш)$/;
let NN = /нн$/;

class Porter {

    static stem(word) {
        word = word.toLowerCase()
        word = word.replace('ё', 'е')
        let m = RVRE.exec(word)
        if (m && m.length) {
            let pre = m[1]
            let rv = m[2]
            let temp = rv.replace(PERFECTIVEGROUND_1, '')
            temp = temp.replace(PERFECTIVEGROUND_2, '$1')
            if (temp == rv) {
                rv = rv.replace(REFLEXIVE, '')
                temp = rv.replace(ADJECTIVE, '')
                if (temp != rv) {
                    rv = temp
                    rv = rv.replace(PARTICIPLE_1, '')
                    rv = rv.replace(PARTICIPLE_2, '$1')
                } else {
                    temp = rv.replace(VERB_1, '')
                    temp = temp.replace(VERB_2, '$1')
                    if (temp == rv) {
                        rv = rv.replace(NOUN, '')
                    } else {
                        rv = temp
                    }
                }
            } else {
                rv = temp
            }
            rv = rv.replace(I, '')
            if (DERIVATIONAL.test(rv)) {
                rv = rv.replace(DER, '')
            }
            temp = rv.replace(P, '')
            if(temp == rv) {
                rv = rv.replace(SUPERLATIVE, '')
                rv = rv.replace(NN, 'н')
            } else {
                rv = temp
            }
            word = pre+rv
        }
        return word
    }

    /*
    Splits text to words and stem each but without shortest than minStemLength.
    Returns array of stemmed words.
     */
    static stemText(text, minStemLen) {
        if (!minStemLen) minStemLen = 4;
        if (!text || !text.length) return [];
        let w1 = text.split(/[^a-zA-Zа-яА-Яё0-9]/ig);
        let w2 = [];
        for (let i = 0; i < w1.length; i++) {
            if (!w1 || !w1.length) continue;
            if (w1[i].length >= minStemLen) {
                w2.push(Porter.stem(w1[i]));
            } else {
                w2.push(w1[i].toLowerCase());
            }
        }
        return w2.filter(x => x.length);
    }
}


