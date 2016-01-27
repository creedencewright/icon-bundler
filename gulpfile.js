var gulp        = require('gulp'),
    mkdirp      = require('mkdirp'),
    chalk       = require('chalk'),
    url         = require('url2'),
    File        = require('vinyl'),
    SVGSpriter  = require('svg-sprite'),
    spritesmith = require('gulp.spritesmith'),
    prefix      = require('gulp-autoprefixer'),
    minifyCss   = require('gulp-minify-css'),
    reload      = require('gulp-livereload'),
    less        = require('gulp-less'),
    glob        = require('glob'),
    path        = require('path'),
    fs          = require('fs'),
    gaze        = require('gaze'),
    handlebars  = require('handlebars');

var templateSource = fs.readFileSync(__dirname + '/style-template.handlebars', 'utf8');

gulp.task('icon', function(gulpcb) {
    var baseStylePath  = '../svg-sprites/public/stylesheets/111/';
    var spriteOutPath  = '../svg-sprites/public/images/111/';
    var styleOutPath   = baseStylePath;
    var svgIn          = '../svg-sprites/public/images/svg/**/*.svg';
    var pngIn          = '../svg-sprites/public/images/svg/**/*.png';
    var spriteFilename = 'sprite';
    var styleFilename  = 'icons';
    var mixinName      = 'icon';

    var p1 = new Promise(function(resolve) {
        var spriter = new SVGSpriter({
            dest: '.',
            mode: {
                css: {
                    dest: './',
                    prefix: '',
                    sprite: path.relative(baseStylePath, spriteOutPath) + '/' + spriteFilename + '.svg',
                    bust: false,
                    render: true
                }
            }
        });

        glob.glob(svgIn, function(err, files) {
            files.forEach(function(file) {
                var filepath = path.resolve(file);

                spriter.add(new File({
                    path: filepath, // Absolute path to the SVG file
                    base: path.dirname(filepath), // Base path (see `name` argument)
                    contents: fs.readFileSync(filepath) // SVG file contents
                }));
            });

            spriter.compile(function(error, result, data) {
                var sprite = result.css.sprite.contents;

                mkdirp.sync(spriteOutPath);
                fs.writeFileSync(spriteOutPath + spriteFilename + '.svg', sprite);

                var setShapeData = function(shape) {
                    return {
                        image: data.css.sprite,
                        svg: true,
                        name: shape.name,
                        pos: shape.position.relative.xy,
                        w: shape.width.outer + 'px',
                        h: shape.height.outer + 'px'
                    };
                };

                resolve(data.css.shapes.map(setShapeData));
            });
        });
    });

    var p2 = new Promise(function(resolve) {
        var spriteData = gulp.src(pngIn)
            .pipe(spritesmith({
                imgName: spriteFilename + '.png',
                cssName: 'style.css',
                algorithm: 'binary-tree',
                padding: 2,
                cssTemplate: function(data) {
                    var setImageData = function(image) {
                        return {
                            svg: false,
                            image: url.relative(baseStylePath, spriteOutPath + image.escaped_image),
                            name: image.name,
                            pos: image.px.offset_x + ' ' + image.px.offset_y,
                            w: image.px.width,
                            h: image.px.height
                        };
                    };

                    resolve({
                        pngs: data.sprites.map(setImageData),
                        sprite: {
                            width: data.spritesheet.width,
                            height: data.spritesheet.height,
                        }
                    });

                    return ''; // prevents css file rendering
                }
            }));

        spriteData.img.pipe(gulp.dest(spriteOutPath))
    });

    var compile = function(values) {
        handlebars.registerHelper('retinize', function(data, name) {
                    return data.pngs.filter(function(s) {return s.name === name + '-2x';}).length !== 0;
                });
        handlebars.registerHelper('math', function(lvalue, operator, rvalue) {
            lvalue = parseFloat(lvalue);
            rvalue = parseFloat(rvalue);

            return {
                "+": lvalue + rvalue,
                "-": lvalue - rvalue,
                "*": lvalue * rvalue,
                "/": lvalue / rvalue,
                "%": lvalue % rvalue
            }[operator];
        });

        var template = handlebars.compile(templateSource);

        var templateData = {
            svgs: values[0],
            pngs: values[1],
            mixinName: mixinName
        };

        var cssStr = template({
            svgs: values[0],
            pngSprite: values[1].sprite,
            pngs: values[1].pngs.map(function(png) {
                if (png.name.indexOf('@2x') === -1) return png;

                png.name = png.name.replace('@2x', '-2x');

                return png;
            }),
            mixinName: mixinName
        });

        mkdirp.sync(styleOutPath);

        fs.writeFileSync(styleOutPath + styleFilename + '.less', cssStr);

        gulpcb();
    };

    Promise.all([p1, p2]).then(compile).catch(function(err) {
        console.log(err);
    });
});

gulp.task('less', function() {
    gulp.src('../svg-sprites/public/stylesheets/style.less')
        .pipe(less())
        .pipe(minifyCss())
        .pipe(prefix('last 3 versions'))
        .pipe(gulp.dest('../svg-sprites/public/stylesheets/111/'))
        .pipe(reload())
});

gulp.task('watch', ['icon', 'less'], function() {
    gaze(['public/images/svg/**/*.png', 'public/images/svg/**/*.svg'], function() {
        this.on('added', function(filepath) {
            console.log(chalk.green(path.basename(filepath) + " was added"));
            gulp.start('icon');
        });
        this.on('deleted', function(filepath) {
            console.log(chalk.red(path.basename(filepath) + " was deleted"));
            gulp.start('icon');
        });
        this.on('changed', function(filepath) {
            console.log(chalk.yellow(path.basename(filepath) + " was changed"));
            gulp.start('icon');
        });
    });

    gaze('public/stylesheets/**/*.less', function() {
        this.on('added', function(filepath) {
            console.log(chalk.green(path.basename(filepath) + " was added"));
            gulp.start('less');
        });
        this.on('deleted', function(filepath) {
            console.log(chalk.red(path.basename(filepath) + " was deleted"));
            gulp.start('less');
        });
        this.on('changed', function(filepath) {
            console.log(chalk.yellow(path.basename(filepath) + " was changed"));
            gulp.start('less');
        });
    })
});

gulp.task('default', ['watch']);