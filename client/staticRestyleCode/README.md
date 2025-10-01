## staticRestyleCode

A directory where I will upload the landing page once it's complete,
... and where I will continue to work on the other pages of the website.

Pull requets & git logs will reveal what changes occur for you
... to integrate via React.

## Todo:

✅ Shared page base
✅ Landing page content
Top chart page content
Trade chart page* content
    *we may forgo this if such a feature is not desired
Portfolio page content
Transaction History page content (accessible from the Portfolio)

Login page content
Registration page content
Password reset page content

## Known issues:

The search bar width changes are not designed very well (too viral).
It's visually fine, but I can change the underlying code later on.

The ARIA accessibility for the sidebar toggler is not compliant.
I'm a noob at a11y, so I'll ask online and combine our brainpower for the best way to achieve the desired
behavior-- with JS or without.

## Stack:

HTML, CSS, Sass

## Development:

Compile SCSS for development:
`sass --watch src/scss:public/css`