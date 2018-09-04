const gulp = require('gulp');
const ts = require('gulp-typescript');
const replace = require('gulp-replace');
const del = require('del');

var browserify = require("browserify");
var source = require('vinyl-source-stream');
var tsify = require("tsify");
var paths = {
  pages: ['src/*.html']
};

const version = require('../package.json').version;

gulp.task('build', ['build:typescript']);

gulp.task('build:prod', ['build:uglify']);

gulp.task('build:clean', function () {
  return del([
    'build/**/*'
  ]);
});


gulp.task('build:typescript', ['typescript:main']);

gulp.task('typescript:main', ['build:clean'], () => {
  const tsProject = ts.createProject('tsconfig.json');
  return tsProject.src()
    .pipe(tsProject())
    .pipe(replace('@{VERSION}', version))
    .pipe(gulp.dest('build/main'));
});

gulp.task("move:webworker", [], function() {
  return gulp.src('src/recorderWorker.js').pipe(gulp.dest('dist'))
})

gulp.task("build:browser", ["move:webworker"], function () {
  return browserify({
      basedir: '.',
      debug: true,
      entries: ['src/index.ts'],
      cache: {},
      packageCache: {},
      ignore: ['recorderWorker']
  })
  .plugin(tsify)
  .bundle()
  .pipe(source('bundle.js'))
  .pipe(gulp.dest("dist"));
});