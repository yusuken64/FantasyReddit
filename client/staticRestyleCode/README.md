## staticRestyleCode

A directory where I will upload the landing page once it's complete,
.. and where I will continue to work on the other pages of the website.

Pull requests & git logs will reveal what changes occur for you
.. to integrate via React.

## Todo:

✅ Shared page base
✅ Landing page content

✅ Top chart page content
✅ Hot chart page content

Options page
✅ Login
✅ Register
✅ password reset page

Leaderboard

✅ Transaction History page content (accessible from the Portfolio)

🚧 Portfolio page content
    🚧 - "Sort by" width not the same as the card group visual width
        (hard >:) )
    ✅ - Portfolio thread list
    ✅ - Holdings page in graphical format on the portfolio
    
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

## Biggest issues as of present:

1. bug where both logged-out button sets for the sidebar & header appear at the same time

2. weird adjustment hack with the header's search bar width

3. hacks throughout the code

4. mobile logged-in destructured account-info variable spacing between the options button and hamburger button