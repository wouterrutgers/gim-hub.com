<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('index');
});

Route::get('/{path}', function () {
    return view('index');
})->where('path', '[^.]*');
