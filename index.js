
const functions = require('firebase-functions')
const admin = require('firebase-admin')

const app = admin.initializeApp(functions.config().firebase);

// var serviceAccount = require("loanApp-382ff99c6ce8.json");

const sendgrid = require('sendgrid');
const SENDGRID_API_KEY = functions.config().sendgrid.key
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');

const nodemailer = require('nodemailer');
// Configure the email transport using the default SMTP transport and a GMail account.
// For other types of transports such as Sendgrid see https://nodemailer.com/transports/
// TODO: Configure the `gmail.email` and `gmail.password` Google Cloud environment variables.
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

exports.sendAcquiredEmail = functions.firestore
  .document('users/{uid}')
  .onUpdate(event => {

  var newValue = event.data.data();
  var oldValue = event.data.previous.data()
  
  // console.error('sending email if new user purchased', newValue.purchased);

  if (newValue.purchased.length <= oldValue.purchased.length)
    return null;

  console.error('new user was acquired');

  // find the acquired borrower
  var newList = newValue.purchased.filter((item) => {
    return oldValue.purchased.indexOf(item) < 0;
  })
  console.error('new list: ', newList);
  if (newList) {
    newList.forEach((e) => { e
      admin.firestore(app).doc(`users/${e}`).get()
      .then(doc => {
        if (doc.exists) {
          const user = doc.data();
          const mailOptions = {
            from: '"Lending Nation." <carloanrefiapp.firebaseapp.com>',
            to: user.email,
            subject: 'Lender Interested!',
            text: 'A lender has shown interest in doing business with you.' + '\n' +
                  'Check your inbox in your web portal for direct messages from the lender'
          };
          return mailTransport.sendMail(mailOptions)
            .then(() => console.log(`New acquisition notice was sent to:`, user.email))
            .catch((error) => console.error('There was an error while sending the email:', error));
        }
      }).catch(error => {
        console.log("Error getting document:", error);
      });
    })
  }
});

exports.sendWelcomeEmail = functions.firestore
  .document('users/{uid}')
  .onCreate(event => {

  var newValue = event.data.data();
  event.data.data()

  const mailOptions = {
    from: '"Lending Nation." <noreply@carloanrefiapp.firebaseapp.com>',
    to: newValue.email,
  };

  // Building Email message.
  mailOptions.subject = 'Thanks and Welcome!';
  mailOptions.text = 'Thank you for joining Lending Nation, your portal for refinancing.' + '\n' +
                      'Please make sure to complete your personal information in the profile section';

  return mailTransport.sendMail(mailOptions)
    .then(() => console.log(`New signup confirmation email sent to:`, newValue.email))
    .catch((error) => console.error('There was an error while sending the email:', error));
});

exports.sendSignupEmailToAdmin = functions.firestore
  .document('users/{uid}')
  .onCreate(event => {

  var newValue = event.data.data();

  const mailOptions = {
    from: '"Lending Nation." <carloanrefiapp.firebaseapp.com>',
    to: 'carloanrefi@gmail.com',
  };

  // Building Email message.
  mailOptions.subject = 'New Member Joined!';
  mailOptions.text = `New member name:  ${newValue.displayName}` + '\n' +
                     `New member email:  ${newValue.email}`;

  return mailTransport.sendMail(mailOptions)
    .then(() => console.log(`New signup confirmation email sent to admin for user:`, newValue.email))
    .catch((error) => console.error('There was an error while sending the email:', error));
});

/*
function parseBody(body) {
  console.log('body: ', body);
  var helper = sendgrid.mail;
  var fromEmail = new helper.Email(body.from);
  var toEmail = new helper.Email(body.to);
  var subject = body.subject;
  var content = new helper.Content('text/html', body.content);
  var mail = new helper.Mail(fromEmail, subject, toEmail, content);
  return  mail.toJSON();
}
*/
exports.updateUser = functions.firestore
  .document('users/{uid}')
  .onUpdate(event => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    var newValue = event.data.data();

    // ...or the previous value before this update
    var previousValue = event.data.previous.data();

    // access a particular field as you would any JS property
    var name = newValue.displayName;

    // perform desired operations ...
    console.log('user name is: ',  name);
    const msg = {
      to: newValue.email,
      from: 'carloanrefi@gmail.com',
      subject: 'test',
      text: 'HEllow world',
      html: '<strong>and easy to do anywhere, even with Node.js</strong>'
    }
    sgMail.send(msg);
});

exports.httpEmail = functions.https.onRequest((req, res) => {
  return Promise.resolve().then(() => {
    console.log('headers', req.headers);
    console.log('Incoming req method is: ', req.method);
    if (req.method === 'POST') {
      console.log('Incoming req method is: ', req.method);
    } else if (req.method === 'OPTIONS') {
      console.log('Incoming req method is: ', req.method);
      // no workie! res.headers['Access-Control-Allow-Origin'] = '*';
      // res.headers['Access-Control-Allow-Headers'] = 'content-type';
      // res.send('');
    } else {
      const error = new Error('Only POST and OPTIONS methods are accepted');
      error.code = 405;
      throw error;    
    }
      console.log('Incoming req body is: ', req.body);
      const msg = {
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject,
        text: req.body.content,
        html: '<strong>and easy to do anywhere, even with Node.js</strong>'
      }
      //sgMail.send(msg);
/*
      const request = client.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: parseBody(req.body)
      });

      return client.API(request)
*/
    }).then((response) => {
      if (response.body) {
        res.send(response.body);
      } else {
        res.end();
      }
    }).catch((err) => {
      console.error(err);
      return Promise.reject(err);
    });
})


/******************************************************************/
/** Stripe */
const stripe = require('stripe')(functions.config().stripe.testkey)

exports.stripeCharge = functions.database
                                .ref('/payments/{userId}/{paymentId}')
                                .onWrite(event => {

  const payment = event.data.val();
  const userId = event.params.userId;
  const paymentId = event.params.paymentId;
  

  // checks if payment exists or if it has already been charged
  if (!payment || payment.charge) return;

  return admin.database()
              .ref(`/users/${userId}`)
              .once('value')
              .then(snapshot => {
                  return snapshot.val();
               })
               .then(customer => {

                 const amount = payment.amount;
                 const idempotency_key = paymentId;  // prevent duplicate charges
                 const source = payment.token.id;
                 const currency = 'usd';
                 const charge = {amount, currency, source};


                 return stripe.charges.create(charge, { idempotency_key });

               })
               .then(charge => {
                   admin.database()
                        .ref(`/payments/${userId}/${paymentId}/charge`)
                        .set(charge)
               })
});