var gulp        = require('gulp'),
    mkdirp      = require('mkdirp'),
    chalk       = require('chalk'),
    url         = require('url2'),
    File        = require('vinyl'),
    SVGSpriter  = require('svg-sprite'),
    spritesmith = require('gulp.spritesmith'),
    less        = require('gulp-less'),
    glob        = require('glob'),
    path        = require('path'),
    fs          = require('fs'),
    gaze        = require('gaze'),
    handlebars  = require('handlebars');

var templateSource = fs.readFileSync(__dirname + '/style-template.handlebars', 'utf8');

gulp.task('icon', function(gulpcb) {
    var baseStylePath  = './public/stylesheets/';
    var spriteOutPath  = './public/images/';
    var styleOutPath   = baseStylePath;
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

        glob.glob('./public/images/svg/*.svg', function(err, files) {
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
        var spriteData = gulp.src('./public/images/svg/*.png')
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

                    resolve(data.sprites.map(setImageData));

                    return ''; // prevents css file rendering
                }
            }));

        spriteData.img.pipe(gulp.dest(spriteOutPath))
    });

    var compile = function(values) {
        var template = handlebars.compile(templateSource);

        var templateData = {
            svgs: values[0],
            pngs: values[1],
            mixinName: mixinName
        };

        var cssStr = template(templateData);

        mkdirp.sync(styleOutPath);

        fs.writeFileSync(styleOutPath + styleFilename + '.less', cssStr);

        gulpcb();
    };

    Promise.all([p1, p2]).then(compile).catch(function(err) {
        console.log(err);
    });
});

gulp.task('less', function() {
    gulp.src('./public/stylesheets/style.less')
        .pipe(less())
        .pipe(gulp.dest('./public/stylesheets/'));
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