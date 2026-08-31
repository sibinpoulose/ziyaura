import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import User from "../models/User.js";

import jwt from "jsonwebtoken";

passport.use(

  new GoogleStrategy(

    {

      clientID: process.env.GOOGLE_CLIENT_ID || "google_client_id_placeholder",

      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "google_client_secret_placeholder",

      callbackURL: "/auth/google/callback"

    },

    async (accessToken, refreshToken, profile, done) => {

      try {

        const email = profile.emails[0].value;

        let user = await User.findOne({ email });

        // USER NOT EXISTS

        if (!user) {

          user = await User.create({

            name: profile.displayName,

            email,

            password: "googlelogin",

            isVerified: true

          });

        }

        // BLOCK CHECK

        if (user.isBlocked) {

          return done(null, false);

        }

        // CREATE JWT TOKEN

        const token = jwt.sign(

          {

            id: user._id,

            role: user.role

          },

          process.env.JWT_SECRET,

          {

            expiresIn: "1d"

          }

        );

        done(null, {

          user,

          token

        });

      } catch (err) {

        done(err, null);

      }

    }

  )

);


// SESSION SAVE

passport.serializeUser((data, done) => {

  done(null, data);

});


// SESSION GET

passport.deserializeUser((data, done) => {

  done(null, data);

});


export default passport;